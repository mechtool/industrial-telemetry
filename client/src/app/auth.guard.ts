import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './services/auth.service';

/**
 * Допускает к защищённым маршрутам только аутентифицированных пользователей.
 * Иначе отправляет на страницу входа.
 *
 * Редирект выполняется с replaceUrl: true, чтобы «назад» в истории браузера
 * не возвращался на защищённую страницу после выхода — иначе оболочка
 * показывалась бы с пустым пользователем или кнопка «назад» зацикливалась.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const current = auth.currentUser();
  if (current) {
    return true;
  }

  // Сессия ещё не подгружена (первый заход / прямой переход по ссылке) —
  // дожидаемся результата /api/session и решаем по нему.
  return auth.checkSession().pipe(
    map((user) => {
      if (user) {
        return true;
      }
      router.navigate(['/login'], { replaceUrl: true });
      return false;
    }),
  );
};
