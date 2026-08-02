import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';

const router = Router();

/** Extract CSRF token from Kratos ui.nodes */
function extractCsrfToken(ui: any): string {
  const nodes: any[] = ui?.nodes ?? [];
  for (const node of nodes) {
    if (node.type === 'input' && node.attributes?.name === 'csrf_token') {
      return node.attributes.value ?? '';
    }
  }
  return '';
}

/** Extract error message from ui.messages or node.messages */
function extractErrorMessage(ui: any): string | null {
  const uiMessages: any[] = ui?.messages ?? [];
  if (uiMessages[0]?.text) return uiMessages[0].text;
  const nodes: any[] = ui?.nodes ?? [];
  for (const node of nodes) {
    const nodeMessages: any[] = node.messages ?? [];
    if (nodeMessages[0]?.text) return nodeMessages[0].text;
  }
  return null;
}

// ============================================================
// Login
// ============================================================
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: { message: 'Email and password required' } });
    return;
  }
  try {
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/login/api`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Unable to create login flow' } });
      return;
    }
    const flow = await flowRes.json();
    const csrfToken = extractCsrfToken(flow.ui);
    const body = new URLSearchParams();
    body.set('method', 'password');
    body.set('csrf_token', csrfToken);
    body.set('identifier', email);
    body.set('password', password);
    const loginRes = await fetch(`${config.kratos.publicUrl}/self-service/login?flow=${flow.id}`, {
      method: flow.ui.method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      redirect: 'manual',
    });
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) res.setHeader('Set-Cookie', setCookie);
    if (loginRes.status === 422 || loginRes.status === 400) {
      const err = await loginRes.json();
      const msg = extractErrorMessage(err?.ui) ?? err?.error?.message ?? 'Login error';
      res.status(400).json({ success: false, error: { message: msg } });
      return;
    }
    if (!loginRes.ok) {
      res.status(502).json({ success: false, error: { message: `Login error (${loginRes.status})` } });
      return;
    }
    const result = await loginRes.json();
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Kratos] Login error:', err.message);
    res.status(502).json({ success: false, error: { message: 'Auth unavailable' } });
  }
});

// ============================================================
// Registration
// ============================================================
router.post('/registration', async (req: Request, res: Response) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    res.status(400).json({ success: false, error: { message: 'Email, username and password required' } });
    return;
  }
  try {
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/registration/api`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Unable to create registration flow' } });
      return;
    }
    const flow = await flowRes.json();
    const csrfToken = extractCsrfToken(flow.ui);
    const body = new URLSearchParams();
    body.set('method', 'password');
    body.set('csrf_token', csrfToken);
    body.set('traits.email', email);
    body.set('traits.username', username);
    body.set('traits.role', 'operator');
    body.set('password', password);
    const regRes = await fetch(`${config.kratos.publicUrl}/self-service/registration?flow=${flow.id}`, {
      method: flow.ui.method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      redirect: 'manual',
    });
    const setCookie = regRes.headers.get('set-cookie');
    if (setCookie) res.setHeader('Set-Cookie', setCookie);
    if (regRes.status === 422 || regRes.status === 400) {
      const err = await regRes.json();
      const msg = extractErrorMessage(err?.ui) ?? err?.error?.message ?? 'Registration error';
      res.status(400).json({ success: false, error: { message: msg } });
      return;
    }
    if (!regRes.ok) {
      res.status(502).json({ success: false, error: { message: `Registration error (${regRes.status})` } });
      return;
    }
    const result = await regRes.json();
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Kratos] Registration error:', err.message);
    res.status(502).json({ success: false, error: { message: 'Auth unavailable' } });
  }
});

// ============================================================
// Recovery — link method
// ============================================================

/**
 * POST /api/kratos/recovery/init
 * Create a recovery flow (no email required — just init)
 */
router.post('/recovery/init', async (_req: Request, res: Response) => {
  try {
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/recovery/api`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Recovery init failed' } });
      return;
    }
    const flow = await flowRes.json();
    res.json({ success: true, data: { flowId: flow.id } });
  } catch (err: any) {
    console.error('[Kratos] Recovery init:', err.message);
    res.status(502).json({ success: false, error: { message: 'Auth unavailable' } });
  }
});

/**
 * POST /api/kratos/recovery
 * Send recovery link to email
 */
router.post('/recovery', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ success: false, error: { message: 'Email required' } });
    return;
  }
  try {
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/recovery/api`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Unable to create recovery flow' } });
      return;
    }
    const flow = await flowRes.json();
    const csrfToken = extractCsrfToken(flow.ui);
    const body = new URLSearchParams();
    body.set('method', 'link');
    body.set('csrf_token', csrfToken);
    body.set('email', email);
    const submitRes = await fetch(`${config.kratos.publicUrl}/self-service/recovery?flow=${flow.id}`, {
      method: flow.ui.method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      redirect: 'manual',
    });
    if (submitRes.status === 422 || submitRes.status === 400) {
      const err = await submitRes.json();
      const msg = extractErrorMessage(err?.ui) ?? err?.error?.message ?? 'Recovery error';
      res.status(400).json({ success: false, error: { message: msg } });
      return;
    }
    if (!submitRes.ok) {
      res.status(502).json({ success: false, error: { message: `Recovery error (${submitRes.status})` } });
      return;
    }
    const result = await submitRes.json();
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Kratos] Recovery:', err.message);
    res.status(502).json({ success: false, error: { message: 'Auth unavailable' } });
  }
});

/**
 * GET /api/kratos/recovery?flow=<id>&token=<token>
 * Fetch recovery flow (with optional token for link-based recovery)
 */
router.get('/recovery', async (req: Request, res: Response) => {
  const flowId = req.query.flow as string;
  const token = req.query.token as string;
  if (!flowId) {
    res.status(400).json({ success: false, error: { message: 'flow ID required' } });
    return;
  }
  try {
    // If token present, submit it to continue the link recovery
    if (token) {
      const kratosUrl = `${config.kratos.publicUrl}/self-service/recovery?flow=${flowId}&token=${token}`;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10_000);
      let r: Response;
      try {
        r = await fetch(kratosUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          redirect: 'manual',
          signal: ac.signal,
        });
      } catch (err: any) {
        clearTimeout(timer);
        res.status(err.name === 'AbortError' ? 504 : 502).json({
          success: false,
          error: { message: err.name === 'AbortError' ? 'Kratos not responding' : 'Auth service unreachable' },
        });
        return;
      }
      clearTimeout(timer);
      if (r.ok) {
        const flow = await r.json();
        res.json({ success: true, data: flow });
        return;
      }
      if (r.status === 302 || r.status === 303) {
        const loc = r.headers.get('location');
        if (loc) {
          const u = new URL(loc);
          const newId = u.searchParams.get('flow') ?? u.searchParams.get('id');
          if (newId) {
            const fr = await fetch(`${config.kratos.publicUrl}/self-service/recovery/flows?id=${newId}`, {
              headers: { 'Accept': 'application/json' },
            });
            if (fr.ok) {
              const d = await fr.json();
              res.json({ success: true, data: d }); return;
            }
          }
        }
      }
      res.status(400).json({ success: false, error: { message: 'Invalid or expired recovery link' } });
      return;
    }
    // No token — just fetch flow data
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/recovery/flows?id=${flowId}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Flow not found or expired' } });
      return;
    }
    const flow = await flowRes.json();
    res.json({ success: true, data: flow });
  } catch (err: any) {
    console.error('[Kratos] Recovery GET:', err.message);
    res.status(502).json({ success: false, error: { message: 'Auth unavailable' } });
  }
});

/**
 * POST /api/kratos/recovery/submit
 * Submit password to complete recovery
 */
router.post('/recovery/submit', async (req: Request, res: Response) => {
  const { flowId, csrfToken, ...fields } = req.body;
  if (!flowId) {
    res.status(400).json({ success: false, error: { message: 'flowId required' } });
    return;
  }
  try {
    const body = new URLSearchParams();
    body.set('csrf_token', csrfToken);
    for (const [k, v] of Object.entries(fields)) { if (v != null) body.set(k, String(v)); }
    const r = await fetch(`${config.kratos.publicUrl}/self-service/recovery?flow=${flowId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      redirect: 'manual',
    });
    if (r.status === 422 || r.status === 400) {
      const e = await r.json();
      const m = extractErrorMessage(e?.ui) ?? e?.error?.message ?? 'Recovery error';
      res.status(400).json({ success: false, error: { message: m } });
      return;
    }
    if (r.status === 302 || r.status === 303) {
      const loc = r.headers.get('location');
      if (loc) {
        const u = new URL(loc);
        const newId = u.searchParams.get('flow') ?? u.searchParams.get('id');
        if (newId) {
          const fr = await fetch(`${config.kratos.publicUrl}/self-service/recovery/flows?id=${newId}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (fr.ok) { const d = await fr.json(); res.json({ success: true, data: d }); return; }
        }
      }
      res.status(502).json({ success: false, error: { message: 'Redirect failed' } });
      return;
    }
    if (!r.ok) {
      res.status(502).json({ success: false, error: { message: 'Recovery error (' + r.status + ')' } });
      return;
    }
    const d = await r.json();
    res.json({ success: true, data: d });
  } catch (e: any) {
    console.error('[Kratos] Recovery submit:', e.message);
    res.status(502).json({ success: false, error: { message: 'Auth unavailable' } });
  }
});

// ============================================================
// Verification
// ============================================================
router.post('/verification/init', async (_req: Request, res: Response) => {
  try {
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/verification/api`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Verification init failed' } });
      return;
    }
    const flow = await flowRes.json();
    res.json({ success: true, data: { flowId: flow.id } });
  } catch (err: any) {
    console.error('[Kratos] Verification init:', err.message);
    res.status(502).json({ success: false, error: { message: 'Auth unavailable' } });
  }
});

router.post('/verification', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ success: false, error: { message: 'Email required' } });
    return;
  }
  try {
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/verification/api`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Verification init failed' } });
      return;
    }
    const flow = await flowRes.json();
    const csrfToken = extractCsrfToken(flow.ui);
    const body = new URLSearchParams();
    body.set('method', 'code');
    body.set('csrf_token', csrfToken);
    body.set('email', email);
    const submitRes = await fetch(`${config.kratos.publicUrl}/self-service/verification?flow=${flow.id}`, {
      method: flow.ui.method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      redirect: 'manual',
    });
    if (submitRes.status === 422 || submitRes.status === 400) {
      const err = await submitRes.json();
      const msg = extractErrorMessage(err?.ui) ?? err?.error?.message ?? 'Verification error';
      res.status(400).json({ success: false, error: { message: msg } });
      return;
    }
    if (!submitRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Verification error (' + submitRes.status + ')' } });
      return;
    }
    const result = await submitRes.json();
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Kratos] Verification:', err.message);
    res.status(502).json({ success: false, error: { message: 'Auth unavailable' } });
  }
});

export default router;
