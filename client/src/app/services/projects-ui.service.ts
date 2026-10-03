import { Injectable, signal } from '@angular/core';

export interface ProjectFilter {
  label: string;
  count: number;
}

/**
 * Общее состояние UI страницы «Проекты»: оболочка (projects-shell) читает
 * эти сигналы, а вложенные представления (empty/list/tiles) устанавливают
 * их при инициализации.
 */
@Injectable({ providedIn: 'root' })
export class ProjectsUiService {
  readonly filters: ProjectFilter[] = [
    { label: 'Все', count: 18 },
    { label: 'В работе', count: 7 },
    { label: 'На проверке', count: 3 },
    { label: 'Завершённые', count: 6 },
    { label: 'На паузе', count: 2 },
    { label: 'Архив', count: 0 },
  ];

  readonly totalCount = 18;

  readonly subtitle = signal('');
  readonly activeFilter = signal('Все');
  readonly shownCount = signal(0);
  readonly isProjectView = signal(false);
}
