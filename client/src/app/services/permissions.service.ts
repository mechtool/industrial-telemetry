import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';

export interface UserPermissions {
  canViewDashboard: boolean;
  canEditMqtt: boolean;
  canManageUsers: boolean;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly http = inject(HttpClient);

  readonly permissions = signal<UserPermissions | null>(null);

  /** Загрузить права текущего пользователя */
  load(): Observable<UserPermissions> {
    return this.http.get<{ success: boolean; data: UserPermissions }>('/api/permissions', {
      withCredentials: true,
    }).pipe(
      map(r => r.data),
      tap(p => this.permissions.set(p)),
    );
  }

  /** Может ли пользователь просматривать указанную страницу */
  canView(resource: string): boolean {
    const p = this.permissions();
    if (!p) return false;
    if (p.role === 'admin') return true; // админ видит всё
    return p.canViewDashboard; // для остальных — базовая проверка
  }

  /** Может ли пользователь редактировать */
  canEdit(resource: string): boolean {
    const p = this.permissions();
    if (!p) return false;
    if (p.role === 'admin') return true;
    if (resource === 'mqtt') return p.canEditMqtt;
    return false;
  }

  /** Может ли управлять пользователями */
  canManageUsers(): boolean {
    return this.permissions()?.canManageUsers ?? false;
  }

  /** Является ли администратором */
  isAdmin(): boolean {
    return this.permissions()?.role === 'admin';
  }
}
