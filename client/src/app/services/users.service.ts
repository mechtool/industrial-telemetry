import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  /** Список пользователей. */
  list(): Observable<AdminUser[]> {
    return this.api.get<AdminUser[]>('/users').pipe(map((res) => res.data));
  }

  /** Изменить роль пользователя. */
  updateRole(id: string, role: string): Observable<AdminUser> {
    return this.api.put<AdminUser>(`/users/${id}/role`, { role }).pipe(map((res) => res.data));
  }
}
