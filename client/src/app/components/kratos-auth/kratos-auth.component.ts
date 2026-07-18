import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

type AuthMode = 'login' | 'registration';

interface KratosProxyResponse {
  success: boolean;
  data?: { id: string; email: string; username: string; role: string };
  error?: { message: string };
}

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

  async submitLogin(): Promise<void> {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await fetch('/api/kratos/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, password: this.password }),
        credentials: 'include',
      });

      const data: KratosProxyResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Неверный email или пароль');
      }

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
      const res = await fetch('/api/kratos/registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.email,
          username: this.username,
          password: this.password,
        }),
        credentials: 'include',
      });

      const data: KratosProxyResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Ошибка регистрации');
      }

      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка регистрации');
    } finally {
      this.loading.set(false);
    }
  }
}
