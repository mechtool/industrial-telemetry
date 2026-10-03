import { Injectable, signal } from '@angular/core';

/**
 * Состояние раздела «Объекты» во вкладке проекта (project-view).
 * hasObjects = true → objects-list, false → object-empty.
 */
@Injectable({ providedIn: 'root' })
export class ObjectsUiService {
  readonly hasObjects = signal(true);
}
