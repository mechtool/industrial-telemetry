import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, map, tap } from 'rxjs';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  roles: string[];
  department?: string;
}

/** Наивысшая роль пользователя из списка. */
export function primaryRole(roles: string[]): string {
  const order = ['admin', 'engineer', 'operator', 'viewer'];
  for (const r of order) {
    if (roles.includes(r)) return r;
  }
  return roles[0] ?? 'viewer';
}

/**
 * Инициалы (2 символа) для аватара.
 * Если username задан — из него (для многословного имени — первые буквы первых двух слов),
 * иначе — первые две буквы email.
 */
export function initialsOf(user: Pick<AuthUser, 'username' | 'email'> | null | undefined): string {
  if (!user) return '?';

  const username = (user.username ?? '').trim();
  if (username) {
    const words = username.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return username.slice(0, 2).toUpperCase();
  }

  const email = (user.email ?? '').trim();
  return email ? email.slice(0, 2).toUpperCase() : '?';
}

interface SessionResponse {
  success: boolean;
  data: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<AuthUser | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly currentRole = computed(() => {
    const user = this.currentUser();
    return user ? primaryRole(user.roles) : null;
  });

  /** Проверить сессию через API сервера (прокси к Kratos /sessions/whoami) */
  checkSession(): Observable<AuthUser | null> {
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
