import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzNotificationService } from 'ng-zorro-antd/notification';

interface RecoveryResponse {
  success: boolean;
  error?: { code?: string; message: string };
}

@Component({
  selector: 'app-auth-recovery',
  standalone: true,
  imports: [FormsModule, NzInputModule, NzButtonModule, NzIconModule],
  templateUrl: './auth-recovery.component.html',
  styleUrl: './auth-recovery.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthRecoveryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notification = inject(NzNotificationService);

  email = '';
  loading = signal(false);

  ngOnInit(): void {
    const flow = this.route.snapshot.queryParams['flow'] ?? '';
    const token = this.route.snapshot.queryParams['token'] ?? '';
    if (flow) {
      // Пользователь перешёл по ссылке из письма — передаём флоу на страницу смены пароля.
      this.router.navigate(['/change-password'], { queryParams: { flow, token } });
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  goToRegistration(): void {
    const email = this.email.trim();
    // Подставляем введённый адрес в форму регистрации, чтобы не набирать заново.
    this.router.navigate(['/registration'], email ? { queryParams: { email } } : {});
  }

  async submitEmail(): Promise<void> {
    if (!this.email) return;
    this.loading.set(true);
    try {
      const r = await fetch('/api/kratos/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email }),
      });
      const d: RecoveryResponse = await r.json();

      // Пользователя нет — вместо письма предлагаем зарегистрироваться.
      if (d.error?.code === 'EMAIL_NOT_REGISTERED') {
        this.notification.warning(
          'Пользователь не зарегистрирован',
          `Пройдите регистрацию`,
        );
        return;
      }

      if (!r.ok || !d.success) throw new Error(d.error?.message || 'Ошибка восстановления');
      this.router.navigate(['/link-sent'], { queryParams: { email: this.email } });
    } catch (e: any) {
      this.notification.error('Ошибка восстановления', e?.message || 'Не удалось отправить ссылку');
    } finally {
      this.loading.set(false);
    }
  }
}
