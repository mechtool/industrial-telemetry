import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';

const router = Router();

/** Извлечь CSRF-токен из ui.nodes ответа Kratos */
function extractCsrfToken(ui: any): string {
  const nodes: any[] = ui?.nodes ?? [];
  for (const node of nodes) {
    if (node.type === 'input' && node.attributes?.name === 'csrf_token') {
      return node.attributes.value ?? '';
    }
  }
  return '';
}

/** Извлечь сообщение об ошибке из ui.messages или node.messages */
function extractErrorMessage(ui: any): string | null {
  // Top-level UI messages
  const uiMessages: any[] = ui?.messages ?? [];
  if (uiMessages[0]?.text) return uiMessages[0].text;

  // Per-node messages (e.g. password validation errors)
  const nodes: any[] = ui?.nodes ?? [];
  for (const node of nodes) {
    const nodeMessages: any[] = node.messages ?? [];
    if (nodeMessages[0]?.text) return nodeMessages[0].text;
  }

  return null;
}

/**
 * POST /api/kratos/login
 * Проксирует Kratos login API flow через сервер (без Origin header → без CSRF-блокировки)
 */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, error: { message: 'Email и пароль обязательны' } });
    return;
  }

  try {
    // 1. Инициализировать login flow через Kratos API
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/login/api`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Не удалось инициализировать вход' } });
      return;
    }

    const flow = await flowRes.json();
    const csrfToken = extractCsrfToken(flow.ui);
    // 2. Отправить учётные данные напрямую в Kratos (не через actionUrl — там localhost)
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

    // 3. Пробросить Set-Cookie заголовки от Kratos клиенту
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    // 4. Обработать ответ
    if (loginRes.status === 422 || loginRes.status === 400) {
      const err = await loginRes.json();
      const msg = extractErrorMessage(err?.ui) ?? err?.error?.message ?? 'Неверный email или пароль';
      res.status(401).json({ success: false, error: { message: msg } });
      return;
    }

    if (!loginRes.ok) {
      const text = await loginRes.text();
      res.status(502).json({ success: false, error: { message: `Ошибка входа (${loginRes.status})` } });
      return;
    }

    const result = await loginRes.json();
    res.json({
      success: true,
      data: {
        id: result.session?.identity?.id ?? '',
        email,
        username: result.session?.identity?.traits?.username ?? email,
        role: result.session?.identity?.traits?.role ?? 'operator',
      },
    });
  } catch (err: any) {
    console.error('[Kratos Proxy] Ошибка логина:', err.message);
    res.status(502).json({ success: false, error: { message: 'Сервис аутентификации недоступен' } });
  }
});

/**
 * POST /api/kratos/registration
 * Проксирует Kratos registration API flow через сервер
 */
router.post('/registration', async (req: Request, res: Response) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    res.status(400).json({ success: false, error: { message: 'Email, имя пользователя и пароль обязательны' } });
    return;
  }

  try {
    // 1. Инициализировать registration flow через Kratos API
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/registration/api`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Не удалось инициализировать регистрацию' } });
      return;
    }

    const flow = await flowRes.json();
    const csrfToken = extractCsrfToken(flow.ui);
    // 2. Отправить данные регистрации напрямую в Kratos
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

    // 3. Пробросить Set-Cookie заголовки от Kratos клиенту
    const setCookie = regRes.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    // 4. Обработать ответ
    if (regRes.status === 422 || regRes.status === 400) {
      const err = await regRes.json();
      const msg = extractErrorMessage(err?.ui) ?? err?.error?.message ?? 'Ошибка регистрации';
      res.status(400).json({ success: false, error: { message: msg } });
      return;
    }

    if (!regRes.ok) {
      res.status(502).json({ success: false, error: { message: `Ошибка регистрации (${regRes.status})` } });
      return;
    }

    const result = await regRes.json();
    res.status(201).json({
      success: true,
      data: {
        id: result.session?.identity?.id ?? '',
        email,
        username,
        role: 'operator',
      },
    });
  } catch (err: any) {
    console.error('[Kratos Proxy] Ошибка регистрации:', err.message);
    res.status(502).json({ success: false, error: { message: 'Сервис аутентификации недоступен' } });
  }
});

/**
 * POST /api/kratos/recovery/init
 * Инициализировать recovery flow через Kratos API, вернуть flow ID
 */
router.post('/recovery/init', async (_req: Request, res: Response) => {
  try {
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/recovery/api`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Не удалось инициализировать восстановление' } });
      return;
    }

    const flow = await flowRes.json();
    res.json({ success: true, data: { flowId: flow.id } });
  } catch (err: any) {
    console.error('[Kratos Proxy] Ошибка инициализации recovery:', err.message);
    res.status(502).json({ success: false, error: { message: 'Сервис аутентификации недоступен' } });
  }
});

/**
 * GET /api/kratos/recovery?flow=<id>
 * Получить данные recovery flow из Kratos
 */
router.get('/recovery', async (req: Request, res: Response) => {
  const flowId = req.query.flow as string;

  if (!flowId) {
    res.status(400).json({ success: false, error: { message: 'Не указан flow ID' } });
    return;
  }

  try {
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/recovery/flows?id=${flowId}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Flow не найден или истек' } });
      return;
    }

    const flow = await flowRes.json();
    res.json({ success: true, data: flow });
  } catch (err: any) {
    console.error('[Kratos Proxy] Ошибка получения recovery flow:', err.message);
    res.status(502).json({ success: false, error: { message: 'Сервис аутентификации недоступен' } });
  }
});

/**
 * POST /api/kratos/recovery
 * Отправить email для восстановления пароля (всегда через новый API flow)
 */
router.post('/recovery', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ success: false, error: { message: 'Email обязателен' } });
    return;
  }

  try {
    // 1. Создать новый API flow (не переиспользовать browser flow из URL)
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/recovery/api`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Не удалось инициализировать восстановление' } });
      return;
    }

    const flow = await flowRes.json();
    const csrfToken = extractCsrfToken(flow.ui);

    // 2. Отправить email в Kratos
    const body = new URLSearchParams();
    body.set('method', 'code');
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
      const msg = extractErrorMessage(err?.ui) ?? err?.error?.message ?? 'Ошибка восстановления';
      res.status(400).json({ success: false, error: { message: msg } });
      return;
    }

    if (!submitRes.ok) {
      res.status(502).json({ success: false, error: { message: `Ошибка восстановления (${submitRes.status})` } });
      return;
    }

    const result = await submitRes.json();
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Kratos Proxy] Ошибка восстановления:', err.message);
    res.status(502).json({ success: false, error: { message: 'Сервис аутентификации недоступен' } });
  }
});

/**
 * POST /api/kratos/verification/init
 * Инициализировать verification flow через Kratos API, вернуть flow ID
 */
router.post('/verification/init', async (_req: Request, res: Response) => {
  try {
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/verification/api`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Не удалось инициализировать верификацию' } });
      return;
    }

    const flow = await flowRes.json();
    res.json({ success: true, data: { flowId: flow.id } });
  } catch (err: any) {
    console.error('[Kratos Proxy] Ошибка инициализации verification:', err.message);
    res.status(502).json({ success: false, error: { message: 'Сервис аутентификации недоступен' } });
  }
});

/**
 * POST /api/kratos/verification
 * Отправить email для верификации (всегда через новый API flow)
 */
router.post('/verification', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ success: false, error: { message: 'Email обязателен' } });
    return;
  }

  try {
    // 1. Создать новый API flow (не переиспользовать browser flow из URL)
    const flowRes = await fetch(`${config.kratos.publicUrl}/self-service/verification/api`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!flowRes.ok) {
      res.status(502).json({ success: false, error: { message: 'Не удалось инициализировать верификацию' } });
      return;
    }

    const flow = await flowRes.json();
    const csrfToken = extractCsrfToken(flow.ui);

    // 2. Отправить email в Kratos
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
      const msg = extractErrorMessage(err?.ui) ?? err?.error?.message ?? 'Ошибка верификации';
      res.status(400).json({ success: false, error: { message: msg } });
      return;
    }

    if (!submitRes.ok) {
      res.status(502).json({ success: false, error: { message: `Ошибка верификации (${submitRes.status})` } });
      return;
    }

    const result = await submitRes.json();
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Kratos Proxy] Ошибка верификации:', err.message);
    res.status(502).json({ success: false, error: { message: 'Сервис аутентификации недоступен' } });
  }
});

export default router;
