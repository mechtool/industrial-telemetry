import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/auth/auth-login/auth-login.component').then(m => m.AuthLoginComponent),
    title: 'Вход — Industrial Telemetry',
  },
  {
    path: 'login',
    loadComponent: () => import('./components/auth/auth-login/auth-login.component').then(m => m.AuthLoginComponent),
    title: 'Вход — Industrial Telemetry',
  },
  {
    path: 'registration',
    loadComponent: () => import('./components/auth/auth-registration/auth-registration.component').then(m => m.AuthRegistrationComponent),
    title: 'Регистрация — Industrial Telemetry',
  },
  {
    path: 'recovery',
    loadComponent: () => import('./components/auth/auth-recovery/auth-recovery.component').then(m => m.AuthRecoveryComponent),
    title: 'Восстановление пароля — Industrial Telemetry',
  },
  {
    path: 'link-sent',
    loadComponent: () => import('./components/auth/auth-link-sent/auth-link-sent.component').then(m => m.AuthLinkSentComponent),
    title: 'Ссылка отправлена — Industrial Telemetry',
  },
  {
    path: 'change-password',
    loadComponent: () => import('./components/auth/auth-change-password/auth-change-password.component').then(m => m.AuthChangePasswordComponent),
    title: 'Изменение пароля — Industrial Telemetry',
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
