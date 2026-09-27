import { Injectable, signal } from '@angular/core';

/**
 * Состояние раздела «Пользователи» в project-shell.
 * hasUsers = true → users-list, false → users-empty.
 */
@Injectable({ providedIn: 'root' })
export class UsersUiService {
  readonly hasUsers = signal(true);
}
