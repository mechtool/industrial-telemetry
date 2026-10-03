import { Injectable, signal } from '@angular/core';

/**
 * Состояние раздела «Организации» во вкладке проекта (project-view).
 * hasOrganizations = true → organizations-list, false → organizations-empty.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationsUiService {
  readonly hasOrganizations = signal(true);
}
