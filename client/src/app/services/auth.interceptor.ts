import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * HTTP-интерсептор, добавляющий JWT-токен к каждому исходящему запросу.
 * При получении 401 автоматически разлогинивает пользователя.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Только если мы уже были залогинены — иначе это просто неудачный login
        if (authService.isAuthenticated()) {
          authService.logout();
        }
      }
      return throwError(() => error);
    }),
  );
};
