import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map } from 'rxjs';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'operator' | 'engineer' | 'admin';
  isActive: boolean;
  lastLogin: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { message: string };
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** Реактивное состояние текущего пользователя */
  readonly currentUser = signal<AuthUser | null>(this.loadUser());

  /** Является ли пользователь аутентифицированным */
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /** Роль текущего пользователя */
  readonly currentRole = computed(() => this.currentUser()?.role ?? null);

  /**
   * Попытка входа в систему.
   * При успехе сохраняет токен, данные пользователя и обновляет сигнал.
   */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<ApiResponse<LoginResponse>>('/api/auth/login', { email, password })
      .pipe(
        map((res) => {
          if (!res.success) {
            throw new Error(res.error?.message ?? 'Ошибка аутентификации');
          }
          return res.data;
        }),
        tap((data) => {
          this.persistSession(data.token, data.user);
          this.currentUser.set(data.user);
        }),
      );
  }

  /**
   * Регистрация нового пользователя.
   * При успехе сохраняет токен и данные пользователя (авто-логин).
   */
  register(username: string, email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<ApiResponse<LoginResponse>>('/api/auth/register', { username, email, password })
      .pipe(
        map((res) => {
          if (!res.success) {
            throw new Error(res.error?.message ?? 'Ошибка регистрации');
          }
          return res.data;
        }),
        tap((data) => {
          this.persistSession(data.token, data.user);
          this.currentUser.set(data.user);
        }),
      );
  }

  /**
   * Проверка токена через серверный эндпоинт /api/auth/me.
   * Используется при инициализации приложения для валидации сохранённого токена.
   */
  validateToken(): Observable<AuthUser> {
    return this.http.get<ApiResponse<AuthUser>>('/api/auth/me').pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.error?.message ?? 'Токен недействителен');
        }
        return res.data;
      }),
      tap((user) => {
        this.currentUser.set(user);
      }),
      catchError(() => {
        this.clearSession();
        return of(null as unknown as AuthUser);
      }),
    );
  }

  /**
   * Выход из системы — удаляет токен, очищает состояние, перенаправляет на страницу входа.
   */
  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /** Получить сохранённый токен */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  // ---- Private helpers ----

  private persistSession(token: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
  }

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
