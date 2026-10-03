import { Injectable, signal } from '@angular/core';

/**
 * Состояние раздела «Пользователи» во вкладке проекта (project-view).
 * hasUsers = true → users-list, false → users-empty.
 */
@Injectable({ providedIn: 'root' })
export class UsersUiService {
  readonly hasUsers = signal(true);
}
