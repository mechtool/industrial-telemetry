import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';
import { UserAuthenticationComponent } from './components/user-authentication/user-authentication.component';

export const routes: Routes = [
  {
    path: 'login',
    component: UserAuthenticationComponent,
    title: 'Вход — Industrial Telemetry',
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Панель управления — Industrial Telemetry',
    canActivate: [authGuard],
  },
  {
    path: 'users',
    loadComponent: () => import('./components/users/users.component').then(m => m.UsersComponent),
    title: 'Пользователи — Industrial Telemetry',
    canActivate: [authGuard],
  },
  {
    path: 'mqtt',
    loadComponent: () => import('./components/mqtt-telemetry/mqtt-telemetry.component').then(m => m.MqttTelemetryComponent),
    title: 'MQTT Телеметрия — Industrial Telemetry',
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
