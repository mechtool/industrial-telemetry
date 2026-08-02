import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/kratos/auth/kratos-auth.component').then(m => m.KratosAuthComponent),
    title: 'Вход — Industrial Telemetry',
  },
  {
    path: 'login',
    loadComponent: () => import('./components/kratos/auth/kratos-auth.component').then(m => m.KratosAuthComponent),
    title: 'Вход — Industrial Telemetry',
  },
  {
    path: 'registration',
    loadComponent: () => import('./components/kratos/auth/kratos-auth.component').then(m => m.KratosAuthComponent),
    title: 'Регистрация — Industrial Telemetry',
  },
  {
    path: 'verification',
    loadComponent: () => import('./components/kratos/verification/kratos-verification.component').then(m => m.KratosVerificationComponent),
    title: 'Верификация — Industrial Telemetry',
  },
  {
    path: 'recovery',
    loadComponent: () => import('./components/kratos/recovery/kratos-recovery.component').then(m => m.KratosRecoveryComponent),
    title: 'Восстановление пароля — Industrial Telemetry',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Панель управления — Industrial Telemetry',
  },
  {
    path: 'profile',
    loadComponent: () => import('./components/user-profile/user-profile.component').then(m => m.UserProfileComponent),
    title: 'Профиль — Industrial Telemetry',
  },
  {
    path: 'dashboard-flex',
    loadComponent: () => import('./components/dashboard-flex/dashboard-flex.component').then(m => m.DashboardFlexComponent),
    title: 'Панель управления — Industrial Telemetry',
  },
  {
    path: 'mqtt',
    loadComponent: () => import('./components/mqtt-telemetry/mqtt-telemetry.component').then(m => m.MqttTelemetryComponent),
    title: 'MQTT Телеметрия — Industrial Telemetry',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
