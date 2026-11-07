import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzNotificationService } from 'ng-zorro-antd/notification';

const RESEND_COOLDOWN_SECONDS = 60;

@Component({
  selector: 'app-auth-check-email',
  standalone: true,
  imports: [NzButtonModule, NzIconModule],
  templateUrl: './auth-check-email.component.html',
  styleUrl: './auth-check-email.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCheckEmailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notification = inject(NzNotificationService);

  token = signal('');
  email = signal('');
  cooldown = signal(RESEND_COOLDOWN_SECONDS);
  loading = signal(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.token.set(this.route.snapshot.queryParams['token'] ?? '');
    this.email.set(this.route.snapshot.queryParams['email'] ?? '');
    this.startCooldown();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  async refuse(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      await fetch('/api/kratos/registration/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.token() }),
      });
    } catch {
      // даже при ошибке сети возвращаем на регистрацию
    } finally {
      this.loading.set(false);
    }
    this.router.navigate(['/registration']);
  }

  async resend(): Promise<void> {
    if (this.cooldown() > 0 || this.loading()) return;
    this.loading.set(true);
    try {
      const r = await fetch('/api/kratos/registration/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.token() }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error?.message || 'Не удалось отправить ссылку');
      this.notification.success('Ссылка отправлена', 'Проверьте почту');
      this.cooldown.set(RESEND_COOLDOWN_SECONDS);
      this.startCooldown();
    } catch (e: any) {
      this.notification.error('Ошибка', e?.message || 'Не удалось отправить ссылку');
    } finally {
      this.loading.set(false);
    }
  }

  private startCooldown(): void {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.cooldown.update((v) => {
        const next = v - 1;
        if (next <= 0) {
          this.stopTimer();
          return 0;
        }
        return next;
      });
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
