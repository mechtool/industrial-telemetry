import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzIconModule } from 'ng-zorro-antd/icon';

type AuthMode = 'login' | 'registration';

interface KratosProxyResponse {
  success: boolean;
  data?: { id: string; email: string; username: string; role: string };
  error?: { message: string };
}

@Component({
  selector: 'app-kratos-auth',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzAlertModule,
    NzIconModule,
  ],
  templateUrl: './kratos-auth.component.html',
  styleUrl: './kratos-auth.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KratosAuthComponent implements OnInit {
  private readonly router = inject(Router);

  mode = signal<AuthMode>('login');
  error = signal<string | null>(null);
  loading = signal(false);

  email = '';
  username = '';
  password = '';
  passwordConfirm = '';

  ngOnInit(): void {
    if (this.router.url.includes('/registration')) {
      this.mode.set('registration');
    }
  }

  setMode(m: AuthMode): void { this.mode.set(m); this.error.set(null); }

  async startRecovery(): Promise<void> {
    try {
      const res = await fetch('/api/kratos/recovery/init', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.router.navigate(['/recovery'], { queryParams: { flow: data.data.flowId } });
        return;
      }
    } catch {
      // Бэкенд недоступен — переходим напрямую
    }
    this.router.navigate(['/recovery']);
  }

  async startVerification(): Promise<void> {
    try {
      const res = await fetch('/api/kratos/verification/init', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.router.navigate(['/verification'], { queryParams: { flow: data.data.flowId } });
        return;
      }
    } catch {
      // Бэкенд недоступен — переходим напрямую
    }
    this.router.navigate(['/verification']);
  }

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
    if (this.password !== this.passwordConfirm) {
      this.error.set('Пароли не совпадают');
      return;
    }
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
