import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { presentationGuard } from './components/presentation/presentation.guard';

export const routes: Routes = [
  // ---- Аутентификация (без оболочки) ----
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

  // ---- Основная оболочка приложения (после входа) ----
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./components/app-shell/app-shell.component').then(m => m.AppShellComponent),
    children: [
      {
        // Первый компонент оболочки — главная страница.
        path: '',
        loadComponent: () => import('./components/main-entrance/main-entrance.component').then(m => m.MainEntranceComponent),
        title: 'Главная — CRYOMON',
      },
      {
        path: 'projects',
        loadComponent: () => import('./components/projects/projects.component').then(m => m.ProjectsComponent),
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
          {
            path: ':id',
            loadComponent: () => import('./components/project/project-view/project-view.component').then(m => m.ProjectViewComponent),
            title: 'Проект — CRYOMON',
          },
        ],
      },
    ],
  },

  // ---- Настройки (отдельная страница, вне оболочки) ----
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent),
    title: 'Настройки — Industrial Telemetry',
  },

  // ---- Публичная презентация возможностей (только для демо-почты) ----
  {
    path: 'presentation',
    canActivate: [presentationGuard],
    loadComponent: () => import('./components/presentation/presentation.component').then(m => m.PresentationComponent),
    title: 'Презентация возможностей — CRYOMON',
    children: [
      {
        path: 'retail',
        loadComponent: () => import('./components/presentation/presentation-retail/presentation-retail.component').then(m => m.PresentationRetailComponent),
        title: 'Презентация: ритейл — CRYOMON',
      },
      {
        path: 'service',
        loadComponent: () => import('./components/presentation/presentation-service/presentation-service.component').then(m => m.PresentationServiceComponent),
        title: 'Презентация: сервис — CRYOMON',
      },
    ],
  },

  // Обратная совместимость со старым адресом главной страницы.
  {
    path: 'main-entrance',
    redirectTo: '',
    pathMatch: 'full',
  },

  {
    path: '**',
    redirectTo: '',
  },
];
