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
    path: 'main-entrance',
    loadComponent: () => import('./components/main-entrance/main-entrance.component').then(m => m.MainEntranceComponent),
    title: 'Главная — CRYOMON',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Панель управления — Industrial Telemetry',
  },
  {
    path: 'projects',
    loadComponent: () => import('./components/projects/projects-shell/projects-shell.component').then(m => m.ProjectsShellComponent),
    title: 'Проекты — CRYOMON',
    children: [
      { path: '', redirectTo: 'list', pathMatch: 'full' },
      {
        path: 'empty',
        loadComponent: () => import('./components/projects/projects-empty/projects-empty.component').then(m => m.ProjectsEmptyComponent),
      },
      {
        path: 'list',
        loadComponent: () => import('./components/projects/projects-list/projects-list.component').then(m => m.ProjectsListComponent),
      },
      {
        path: 'tiles',
        loadComponent: () => import('./components/projects/projects-tiles/projects-tiles.component').then(m => m.ProjectsTilesComponent),
      },
    ],
  },
  {
    path: 'project/:id',
    loadComponent: () => import('./components/project/project-shell/project-shell.component').then(m => m.ProjectShellComponent),
    title: 'Проект — CRYOMON',
    children: [
      { path: '', redirectTo: 'general', pathMatch: 'full' },
      {
        path: 'general',
        loadComponent: () => import('./components/project/project-view/project-view.component').then(m => m.ProjectViewComponent),
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./components/project/project-dashboard/project-dashboard.component').then(m => m.ProjectDashboardComponent),
      },
      {
        path: 'users',
        loadComponent: () => import('./components/project/project-users/users-list/users-list.component').then(m => m.UsersListComponent),
      },
      {
        path: 'users-empty',
        loadComponent: () => import('./components/project/project-users/users-empty/users-empty.component').then(m => m.UsersEmptyComponent),
      },
    ],
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
