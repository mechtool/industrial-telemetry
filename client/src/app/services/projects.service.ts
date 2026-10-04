import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  monitoringType: string;
  address: string;
  phone: string;
  workMode: string;
  manager: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  code: string;
  name: string;
  status: string;
  monitoringType: string;
  address?: string;
  phone?: string;
  workMode?: string;
  manager?: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly api = inject(ApiService);

  /** Внутренний триггер повторной загрузки списка после создания проекта. */
  private readonly refresh$ = new BehaviorSubject<number>(0);

  /** Список проектов пользователя; автоматически перечитывается после создания. */
  readonly projects$: Observable<Project[]> = this.refresh$.pipe(
    switchMap(() => this.api.get<Project[]>('/projects')),
    map((res) => res.data),
    catchError(() => of([])),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  create(input: CreateProjectInput): Observable<Project> {
    return this.api.post<Project>('/projects', input).pipe(
      map((res) => res.data),
      tap(() => this.refresh$.next(this.refresh$.value + 1)),
    );
  }
}
