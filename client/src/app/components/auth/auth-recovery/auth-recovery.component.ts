import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

interface RecoveryResponse {
  success: boolean;
  error?: { message: string };
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

  email = '';
  error = signal<string | null>(null);
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
    this.router.navigate(['/registration']);
  }

  async submitEmail(): Promise<void> {
    if (!this.email) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await fetch('/api/kratos/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email }),
      });
      const d: RecoveryResponse = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error?.message || 'Ошибка восстановления');
      this.router.navigate(['/link-sent'], { queryParams: { email: this.email } });
    } catch (e: any) {
      this.error.set(e?.message || 'Ошибка восстановления');
    } finally {
      this.loading.set(false);
    }
  }
}
