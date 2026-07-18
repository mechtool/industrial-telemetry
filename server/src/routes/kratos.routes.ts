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

/** Извлечь сообщение об ошибке из ui.messages */
function extractErrorMessage(ui: any): string | null {
  const messages: any[] = ui?.messages ?? [];
  return messages[0]?.text ?? null;
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
    const actionUrl = flow.ui.action;

    // 2. Отправить учётные данные на action URL
    const body = new URLSearchParams();
    body.set('method', 'password');
    body.set('csrf_token', csrfToken);
    body.set('identifier', email);
    body.set('password', password);

    const loginRes = await fetch(actionUrl, {
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
    const actionUrl = flow.ui.action;

    // 2. Отправить данные регистрации на action URL
    const body = new URLSearchParams();
    body.set('method', 'password');
    body.set('csrf_token', csrfToken);
    body.set('traits.email', email);
    body.set('traits.username', username);
    body.set('traits.role', 'operator');
    body.set('password', password);

    const regRes = await fetch(actionUrl, {
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

export default router;
