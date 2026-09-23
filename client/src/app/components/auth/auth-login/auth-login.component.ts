import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { AuthService } from '../../../services/auth.service';

interface KratosProxyResponse {
  success: boolean;
  data?: { id: string; email: string; username: string; role: string };
  error?: { message: string };
}

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [FormsModule, NzInputModule, NzButtonModule, NzIconModule],
  templateUrl: './auth-login.component.html',
  styleUrl: './auth-login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLoginComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NzNotificationService);

  email = '';
  password = '';
  loading = signal(false);

  startRecovery(): void {
    this.router.navigate(['/recovery']);
  }

  goToRegistration(): void {
    this.router.navigate(['/registration']);
  }

  async submitLogin(): Promise<void> {
    this.loading.set(true);

    try {
      const res = await fetch('/api/kratos/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, password: this.password }),
        credentials: 'include',
      });

      const data: KratosProxyResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Неверные данные для входа');
      }

      this.authService.checkSession().subscribe();
      this.notification.info('Вход выполнен', 'Вы успешно вошли в систему');
      this.router.navigate(['/projects']);
    } catch (err: any) {
      this.notification.error('Ошибка входа', err?.message || 'Не удалось выполнить вход');
    } finally {
      this.loading.set(false);
    }
  }
}
