import { Injectable, signal } from '@angular/core';

/**
 * Состояние раздела «Шлюзы» во вкладке проекта (project-view).
 * hasGateways = true → gateways-list, false → gateways-empty.
 */
@Injectable({ providedIn: 'root' })
export class GatewaysUiService {
  readonly hasGateways = signal(true);
}
