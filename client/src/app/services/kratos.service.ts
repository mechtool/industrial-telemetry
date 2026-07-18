import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, of, map, tap } from 'rxjs';

export interface KratosUser {
  id: string;
  email: string;
  username: string;
  role: string;
  department?: string;
}

interface SessionResponse {
  success: boolean;
  data: KratosUser;
}

/** URL Kratos Public API (проксируется через nginx или прямой) */
const KRATOS_URL = '/.ory';

@Injectable({ providedIn: 'root' })
export class KratosService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly currentUser = signal<KratosUser | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly currentRole = computed(() => this.currentUser()?.role ?? null);

  /** Проверить сессию через API сервера (прокси к Kratos /sessions/whoami) */
  checkSession(): Observable<KratosUser | null> {
    return this.http.get<SessionResponse>('/api/session', { withCredentials: true }).pipe(
      map((res) => res.data),
      tap((user) => this.currentUser.set(user)),
      catchError(() => {
        this.currentUser.set(null);
        return of(null);
      }),
    );
  }

  /** Запустить поток логина Kratos */
  startLogin(): void {
    window.location.href = `${KRATOS_URL}/self-service/login/browser`;
  }

  /** Запустить поток регистрации Kratos */
  startRegistration(): void {
    window.location.href = `${KRATOS_URL}/self-service/registration/browser`;
  }

  /** Запустить поток восстановления пароля Kratos */
  startRecovery(): void {
    window.location.href = `${KRATOS_URL}/self-service/recovery/browser`;
  }

  /** Выход через Kratos */
  logout(): void {
    this.currentUser.set(null);
    window.location.href = `${KRATOS_URL}/self-service/logout/browser`;
  }

  /** URL для страницы настроек Kratos */
  startSettings(): void {
    window.location.href = `${KRATOS_URL}/self-service/settings/browser`;
  }
}
