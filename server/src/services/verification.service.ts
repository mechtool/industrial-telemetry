import { randomBytes, createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { fetchWithTimeout } from '../lib/fetch.js';

export interface PendingRegistration {
  token: string;
  email: string;
  username: string;
  password: string;
  createdAt: number;
  expiresAt: number;
  invalidated: boolean;
}

const PENDING_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

class VerificationService {
  private readonly pending = new Map<string, PendingRegistration>();

  private transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

  private getTransporter() {
    if (!this.transporter) {
      const url = new URL(config.mail.smtpUrl);
      this.transporter = nodemailer.createTransport({
        host: url.hostname,
        port: parseInt(url.port || (url.protocol === 'smtps:' ? '465' : '25'), 10),
        secure: url.protocol === 'smtps:',
        auth: url.username
          ? { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) }
          : undefined,
        tls: { rejectUnauthorized: config.mail.smtpRejectUnauthorized },
      });
    }
    return this.transporter;
  }

  /** Существует ли активный identity с таким email в Kratos. */
  async isEmailRegistered(email: string): Promise<boolean> {
    const url = `${config.kratos.adminUrl}/admin/identities?credentials_identifier=${encodeURIComponent(email)}&per_page=5`;
    const r = await fetchWithTimeout(url, {}, 10_000);
    if (!r.ok) return false;
    const identities = (await r.json()) as Array<{ state?: string }>;
    return identities.some((i) => i.state === 'active');
  }

  /** Создать ожидающую регистрацию и вернуть токен подтверждения. */
  async create(email: string, username: string, password: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    this.pending.set(token, {
      token,
      email,
      username,
      password,
      createdAt: now,
      expiresAt: now + PENDING_TTL_MS,
      invalidated: false,
    });
    this.cleanup();
    return token;
  }

  /** Получить валидную (не просроченную и не отменённую) pending-регистрацию. */
  get(token: string): PendingRegistration | null {
    const p = this.pending.get(token);
    if (!p) return null;
    if (p.invalidated || p.expiresAt < Date.now()) return null;
    return p;
  }

  /**
   * Валидирует пароль по политике, близкой к Kratos (длина + утечки).
   * Возвращает сообщение об ошибке либо null, если пароль допустим.
   */
  async validatePassword(password: string): Promise<string | null> {
    if (password.length < 8) {
      return 'Пароль должен содержать не менее 8 символов';
    }
    if (password.length > 72) {
      return 'Пароль слишком длинный (максимум 72 символа)';
    }
    if (await this.isPasswordBreached(password)) {
      return 'Этот пароль встречался в утечках данных. Придумайте другой пароль.';
    }
    return null;
  }

  /**
   * Проверка пароля по базе утечек HIBP (k-anonymity: отправляем только первые
   * 5 символов SHA-1). При недоступности API возвращает false и не блокирует.
   */
  private async isPasswordBreached(password: string): Promise<boolean> {
    const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    try {
      const r = await fetchWithTimeout(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        { headers: { 'Add-Padding': 'true' } },
        5_000,
      );
      if (!r.ok) return false;
      const text = await r.text();
      return text
        .split(/\r?\n/)
        .some((line) => line.split(':')[0] === suffix);
    } catch {
      // Сеть/таймаут — не блокируем регистрацию.
      return false;
    }
  }

  /** Отменить ссылку (кнопка «Отказаться»). */
  invalidate(token: string): boolean {
    const p = this.pending.get(token);
    if (!p) return false;
    p.invalidated = true;
    return true;
  }

  /** Получить и удалить pending-регистрацию (одноразовое использование ссылки). */
  consume(token: string): PendingRegistration | null {
    const p = this.get(token);
    if (p) this.pending.delete(token);
    return p;
  }

  /** Отправить письмо с ссылкой подтверждения. */
  async sendVerificationEmail(token: string): Promise<void> {
    const p = this.pending.get(token);
    if (!p || p.invalidated || p.expiresAt < Date.now()) {
      throw new Error('Ссылка для подтверждения недействительна');
    }

    const link = `${config.mail.appBaseUrl}/api/kratos/verify-email?token=${p.token}`;
    const transporter = this.getTransporter();

    await transporter.sendMail({
      from: config.mail.from,
      to: p.email,
      subject: 'Подтверждение регистрации Industrial Telemetry',
      text: `Подтвердите ваш email, перейдя по ссылке: ${link}`,
      html: [
        '<p>Вы запросили регистрацию в Industrial Telemetry.</p>',
        '<p>Подтвердите ваш email, перейдя по ссылке:</p>',
        `<p><a href="${link}">${link}</a></p>`,
      ].join('\n'),
    });
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, p] of this.pending) {
      if (p.expiresAt < now) this.pending.delete(key);
    }
  }
}

export const verificationService = new VerificationService();
