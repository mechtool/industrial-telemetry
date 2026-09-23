import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
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
  selector: 'app-auth-registration',
  standalone: true,
  imports: [FormsModule, NzInputModule, NzButtonModule, NzIconModule],
  templateUrl: './auth-registration.component.html',
  styleUrl: './auth-registration.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthRegistrationComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NzNotificationService);

  email = signal('');
  username = signal('');
  password = signal('');
  passwordConfirm = signal('');
  loading = signal(false);

  readonly minLengthOk = computed(() => this.password().length >= 8);
  readonly hasUppercase = computed(() => /[A-ZА-ЯЁ]/.test(this.password()));
  readonly hasDigit = computed(() => /\d/.test(this.password()));
  readonly hasSpecial = computed(() => /[^A-Za-zА-Яа-яЁё0-9\s]/.test(this.password()));
  readonly requirementsMet = computed(
    () => this.minLengthOk() && this.hasUppercase() && this.hasDigit() && this.hasSpecial(),
  );
  readonly passwordsMatch = computed(() => !!this.password() && this.password() === this.passwordConfirm());

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  async submitRegistration(): Promise<void> {
    const email = this.email().trim();
    const password = this.password();
    const confirm = this.passwordConfirm();

    if (!email || !password || !confirm) return;

    if (password !== confirm) {
      this.notification.error('Ошибка регистрации', 'Пароли не совпадают');
      return;
    }

    if (!this.requirementsMet()) {
      this.notification.error('Ошибка регистрации', 'Пароль не соответствует требованиям');
      return;
    }

    this.loading.set(true);

    try {
      const res = await fetch('/api/kratos/registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username: this.username().trim() || email,
          password,
        }),
        credentials: 'include',
      });

      const data: KratosProxyResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Ошибка регистрации');
      }

      this.authService.checkSession().subscribe();
      this.notification.success('Регистрация выполнена', 'Вы успешно зарегистрировались');
      this.router.navigate(['/projects']);
    } catch (err: any) {
      this.notification.error('Ошибка регистрации', err?.message || 'Не удалось завершить регистрацию');
    } finally {
      this.loading.set(false);
    }
  }
}
