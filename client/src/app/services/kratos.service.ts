import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

@Injectable({ providedIn: 'root' })
export class KratosService {
  private readonly http = inject(HttpClient);

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

  /** Выход через Kratos */
  logout(): void {
    this.currentUser.set(null);
    window.location.href = '/.ory/self-service/logout/browser';
  }
}
