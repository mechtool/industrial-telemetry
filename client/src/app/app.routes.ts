import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Панель управления — Industrial Telemetry',
  },
  {
    path: 'users',
    loadComponent: () => import('./components/users/users.component').then(m => m.UsersComponent),
    title: 'Пользователи — Industrial Telemetry',
  },
  {
    path: 'mqtt',
    loadComponent: () => import('./components/mqtt-telemetry/mqtt-telemetry.component').then(m => m.MqttTelemetryComponent),
    title: 'MQTT Телеметрия — Industrial Telemetry',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
