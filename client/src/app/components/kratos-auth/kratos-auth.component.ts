import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

type AuthMode = 'login' | 'registration';

@Component({
  selector: 'app-kratos-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, InputTextModule, MessageModule],
  templateUrl: './kratos-auth.component.html',
  styleUrl: './kratos-auth.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KratosAuthComponent {
  private readonly router = inject(Router);

  mode = signal<AuthMode>('login');
  error = signal<string | null>(null);
  loading = signal(false);

  email = '';
  username = '';
  password = '';
  passwordConfirm = '';

  setMode(m: AuthMode): void { this.mode.set(m); this.error.set(null); }

  /** Переписать action URL с localhost:4433 на /.ory/ (через nginx proxy) */
  private fixActionUrl(action: string): string {
    return action.replace(/^http:\/\/localhost:4433\//, '/.ory/');
  }

  async submitLogin(): Promise<void> {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      // 1. Создать login flow
      const flowRes = await fetch('/.ory/self-service/login/api', { credentials: 'include' });
      const flow = await flowRes.json();

      // 2. Отправить учётные данные
      const body = new URLSearchParams();
      body.set('method', 'password');
      body.set('csrf_token', '');
      body.set('identifier', this.email);
      body.set('password', this.password);

      const loginRes = await fetch(this.fixActionUrl(flow.ui.action), {
        method: flow.ui.method,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: body.toString(),
        credentials: 'include',
        redirect: 'manual',
      });

      if (loginRes.status === 422 || loginRes.status === 400) {
        const err = await loginRes.json();
        throw new Error(err?.ui?.messages?.[0]?.text || err?.error?.message || 'Неверный email или пароль');
      }
      if (!loginRes.ok) throw new Error('Ошибка входа');

      // 3. Успех — на дашборд
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка входа');
    } finally {
      this.loading.set(false);
    }
  }

  async submitRegistration(): Promise<void> {
    if (!this.email || !this.username || !this.password) return;
    if (this.password !== this.passwordConfirm) { this.error.set('Пароли не совпадают'); return; }
    this.loading.set(true);
    this.error.set(null);

    try {
      // 1. Создать registration flow
      const flowRes = await fetch('/.ory/self-service/registration/api', { credentials: 'include' });
      const flow = await flowRes.json();

      // 2. Отправить данные
      const body = new URLSearchParams();
      body.set('method', 'password');
      body.set('csrf_token', '');
      body.set('traits.email', this.email);
      body.set('traits.username', this.username);
      body.set('traits.role', 'operator');
      body.set('password', this.password);

      const regRes = await fetch(this.fixActionUrl(flow.ui.action), {
        method: flow.ui.method,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: body.toString(),
        credentials: 'include',
        redirect: 'manual',
      });

      if (regRes.status === 422 || regRes.status === 400) {
        const err = await regRes.json();
        throw new Error(err?.ui?.messages?.[0]?.text || err?.error?.message || 'Ошибка регистрации');
      }
      if (!regRes.ok) throw new Error('Ошибка регистрации');

      // 3. Успех — на дашборд
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка регистрации');
    } finally {
      this.loading.set(false);
    }
  }
}
