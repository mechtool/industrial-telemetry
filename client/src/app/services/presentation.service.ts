import { Injectable, signal } from '@angular/core';

/**
 * Публичная презентация возможностей приложения.
 *
 * Открывается только демо-пользователям:
 *   - service@telemetry.ru — точка зрения сервисных организаций;
 *   - retail@telemetry.ru  — точка зрения торгового ритейла.
 * Пароль у обеих учётных записей одинаковый: `presentation`.
 * Точка зрения определяется исключительно по почте.
 */
export type PresentationPerspective = 'retail' | 'service';

export const PRESENTATION_EMAILS: Record<PresentationPerspective, string> = {
  service: 'service@telemetry.ru',
  retail: 'retail@telemetry.ru',
};

export const PRESENTATION_PASSWORD = 'presentation';

const STORAGE_KEY = 'presentation.perspective';

@Injectable({ providedIn: 'root' })
export class PresentationService {
  readonly perspective = signal<PresentationPerspective>(this.restore());

  /** Определить точку зрения по почте демо-пользователя. */
  perspectiveForEmail(email: string | null | undefined): PresentationPerspective | null {
    const normalized = email?.trim().toLowerCase();
    if (normalized === PRESENTATION_EMAILS.service) return 'service';
    if (normalized === PRESENTATION_EMAILS.retail) return 'retail';
    return null;
  }

  /** Является ли почта одной из демо-почт презентации. */
  isPresentationEmail(email: string | null | undefined): boolean {
    return this.perspectiveForEmail(email) !== null;
  }

  /** Зафиксировать точку зрения презентации. */
  setPerspective(perspective: PresentationPerspective): void {
    this.perspective.set(perspective);
    this.persist(perspective);
  }

  /** Синхронизировать точку зрения с почтой пользователя (если это демо-почта). */
  syncFromEmail(email: string | null | undefined): PresentationPerspective | null {
    const perspective = this.perspectiveForEmail(email);
    if (perspective) {
      this.setPerspective(perspective);
    }
    return perspective;
  }

  /**
   * Зафиксировать точку зрения по почте после успешного входа.
   * Возвращает true, если это демо-пользователь презентации.
   */
  captureFromEmail(email: string): boolean {
    return this.syncFromEmail(email) !== null;
  }

  private restore(): PresentationPerspective {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === 'service' ? 'service' : 'retail';
    } catch {
      return 'retail';
    }
  }

  private persist(perspective: PresentationPerspective): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, perspective);
    } catch {
      // sessionStorage может быть недоступен — некритично, состояние живёт в signal.
    }
  }
}
