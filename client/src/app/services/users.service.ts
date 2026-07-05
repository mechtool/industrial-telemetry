import { Injectable, inject } from '@angular/core';
import { ApiService, ApiResponse } from './api.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'operator' | 'engineer' | 'admin';
  isActive: boolean;
  lastLogin?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreatePayload {
  username: string;
  email: string;
  role: 'operator' | 'engineer' | 'admin';
  metadata?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  getUsers(page = 1, limit = 20, search = ''): Observable<ApiResponse<User[]>> {
    return this.api.get<User[]>('/users', { page, limit, search });
  }

  getUser(id: string): Observable<User> {
    return this.api.get<User>(`/users/${id}`).pipe(map(r => r.data));
  }

  createUser(payload: UserCreatePayload): Observable<User> {
    return this.api.post<User>('/users', payload).pipe(map(r => r.data));
  }

  updateUser(id: string, payload: Partial<UserCreatePayload>): Observable<User> {
    return this.api.put<User>(`/users/${id}`, payload).pipe(map(r => r.data));
  }

  deleteUser(id: string): Observable<{ id: string }> {
    return this.api.delete<{ id: string }>(`/users/${id}`).pipe(map(r => r.data));
  }
}
