import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzNotificationService } from 'ng-zorro-antd/notification';

const RESEND_COOLDOWN_SECONDS = 60;

@Component({
  selector: 'app-auth-link-sent',
  standalone: true,
  imports: [NzButtonModule, NzIconModule],
  templateUrl: './auth-link-sent.component.html',
  styleUrl: './auth-link-sent.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLinkSentComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notification = inject(NzNotificationService);

  email = signal('');
  cooldown = signal(RESEND_COOLDOWN_SECONDS);
  loading = signal(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.email.set(this.route.snapshot.queryParams['email'] ?? '');
    this.startCooldown();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  async resend(): Promise<void> {
    if (this.cooldown() > 0 || this.loading()) return;
    this.loading.set(true);
    try {
      const r = await fetch('/api/kratos/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email() }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error?.message || 'Не удалось отправить письмо');
      this.notification.success('Ссылка отправлена', 'Проверьте почту');
      this.cooldown.set(RESEND_COOLDOWN_SECONDS);
      this.startCooldown();
    } catch (e: any) {
      this.notification.error('Ошибка', e?.message || 'Не удалось отправить письмо');
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
