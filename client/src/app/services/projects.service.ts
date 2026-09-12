import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export type ProjectStatus = 'active' | 'paused' | 'archived';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly api = inject(ApiService);

  readonly projects = signal<Project[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Загрузить проекты текущего пользователя с сервера. */
  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.get<Project[]>('/projects').subscribe({
      next: (res) => {
        this.projects.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error?.message ?? 'Не удалось загрузить проекты');
        this.projects.set([]);
        this.loading.set(false);
      },
    });
  }

  /** Создать проект для текущего пользователя. */
  create(input: CreateProjectInput): Observable<Project> {
    return this.api.post<Project>('/projects', input).pipe(map((res) => res.data));
  }
}
