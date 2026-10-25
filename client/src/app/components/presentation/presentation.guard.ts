import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService, AuthUser } from '../../services/auth.service';
import { PresentationService } from '../../services/presentation.service';

/**
 * Допускает к презентации только демо-пользователей
 * service@telemetry.ru и retail@telemetry.ru.
 * Остальных отправляет на страницу входа.
 *
 * Публичная рекламная область — проверка только по почте из сессии,
 * без серверной авторизации.
 */
export const presentationGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const presentation = inject(PresentationService);

  const allow = (user: AuthUser | null) => {
    if (presentation.isPresentationEmail(user?.email)) {
      return true;
    }
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  };

  const current = auth.currentUser();
  if (current) {
    return allow(current);
  }

  // Сессия ещё не подгружена (например, прямой переход по ссылке) —
  // дожидаемся результата /api/session и решаем по нему.
  return auth.checkSession().pipe(map(allow));
};
