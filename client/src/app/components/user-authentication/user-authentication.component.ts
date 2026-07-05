import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { FloatLabelModule } from 'primeng/floatlabel';
import { AuthService } from '../../services/auth.service';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-user-authentication',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    FloatLabelModule,
  ],
  templateUrl: './user-authentication.component.html',
  styleUrl: './user-authentication.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAuthenticationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  mode = signal<AuthMode>('login');
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  /** Форма логина */
  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  /** Форма регистрации */
  registerForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(64)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: this.passwordsMatchValidator });

  /** Переключение между логином и регистрацией */
  switchMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
    this.loading.set(false);
  }

  /** Обработка отправки формы (логин или регистрация) */
  onSubmit(): void {
    if (this.mode() === 'login') {
      this.handleLogin();
    } else {
      this.handleRegister();
    }
  }

  private handleLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        const reason: string | undefined = err?.error?.error?.reason;

        if (reason === 'user_not_found') {
          // Авто-переключение на регистрацию с предзаполненным email
          this.registerForm.patchValue({ email });
          this.switchMode('register');
          this.errorMessage.set('Пользователь не найден. Заполните данные для регистрации.');
        } else {
          this.errorMessage.set(
            err?.error?.error?.message ??
            err?.message ??
            'Ошибка аутентификации. Проверьте введённые данные.',
          );
          this.loginForm.get('password')?.reset();
        }
      },
    });
  }

  private handleRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { username, email, password } = this.registerForm.value;

    this.authService.register(username, email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err?.error?.error?.message ??
          err?.message ??
          'Ошибка регистрации. Попробуйте позже.',
        );
      },
    });
  }

  /** Валидатор совпадения паролей */
  private passwordsMatchValidator(group: FormGroup): null | { passwordsMismatch: boolean } {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { passwordsMismatch: true } : null;
  }
}
