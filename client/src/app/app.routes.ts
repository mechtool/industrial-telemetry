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
    path: 'projects/new',
    loadComponent: () => import('./components/project-create/project-create.component').then(m => m.ProjectCreateComponent),
    title: 'Новый проект — Industrial Telemetry',
  },
  {
    path: 'projects',
    loadComponent: () => import('./components/projects/projects.component').then(m => m.ProjectsComponent),
    title: 'Проекты — Industrial Telemetry',
  },
  {
    path: 'users',
    loadComponent: () => import('./components/users/users.component').then(m => m.UsersComponent),
    title: 'Пользователи и роли — Industrial Telemetry',
  },
  {
    path: 'settings',
    loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent),
    title: 'Настройки — Industrial Telemetry',
  },
  {
    path: 'profile',
    loadComponent: () => import('./components/user-profile/user-profile.component').then(m => m.UserProfileComponent),
    title: 'Профиль — Industrial Telemetry',
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
