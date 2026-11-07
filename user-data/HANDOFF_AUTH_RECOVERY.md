# HANDOFF: проверка зарегистрированного пользователя при восстановлении пароля

**Статус:** ✅ выполнено 2026-11-07
**Проект:** `C:\Users\Saturn\WebstormProjects\industrial-telemetry`
**Ветка:** `master`, HEAD `42a7fe9` + незакоммиченные правки

---

## 1. Исходная задача

> При восстановлении пароля нужно проверять, что пользователь зарегистрирован,
> и выдавать сообщение о незарегистрированном пользователе, если он пытается
> воспользоваться формой восстановления, и предлагать ему регистрацию.

Уточнение от заказчика: сообщения показывать **не внутри формы, а через
`nz-notification`**, по образцу логина (`this.notification.error(title, content)`).

---

## 2. Что сделано

| Файл | Изменение |
|---|---|
| `server/src/services/verification.service.ts` | Новый метод `checkEmailRegistered(email): Promise<boolean \| null>` — отличает «пользователя точно нет» (`false`) от «Kratos недоступен, проверить нельзя» (`null`). Существующий `isEmailRegistered` не тронут. |
| `server/src/routes/kratos.routes.ts` | `POST /api/kratos/recovery`: проверка до создания флоу. `false` → `404` с `code: 'EMAIL_NOT_REGISTERED'`; `null` → обычный сценарий (fail-open). |
| `server/src/routes/kratos.routes.ts` | `POST /login`: проверка переведена на `checkEmailRegistered`, сравнение строго с `false`. |
| `client/.../auth-recovery/auth-recovery.component.ts` | Инжектится `NzNotificationService`. Убраны сигналы `error` и `needsRegistration` — сообщения уходят в уведомления. `goToRegistration()` передаёт введённый email в форму регистрации. |
| `client/.../auth-recovery/auth-recovery.component.html` | Инлайновые блоки ошибки и CTA удалены; форма осталась прежней. |
| `client/.../auth-recovery/auth-recovery.component.css` | Удалены неиспользуемые `.form-error` и `.form-info*`. |
| `client/.../auth-login/auth-login.component.ts` | Убран мёртвый сигнал `loginError`; `EMAIL_NOT_REGISTERED` → `notification.warning(...)`. `goToRegistration()` передаёт email. |
| `client/.../auth-login/auth-login.component.html` | Инлайновый блок ошибки удалён. |
| `client/.../auth-login/auth-login.component.css` | Удалены неиспользуемые `.form-error`, `.form-error-link`. |
| `client/.../auth-registration/auth-registration.component.ts` | Предзаполнение email из `?email=` — переход из восстановления не теряет адрес. |

### Как теперь показываются сообщения

```ts
// recovery: пользователя нет
this.notification.warning(
  'Пользователь не зарегистрирован',
  `Аккаунта с адресом ${this.email.trim()} нет. Создайте его, чтобы пользоваться восстановлением пароля.`,
);

// recovery: прочие сбои
this.notification.error('Ошибка восстановления', e?.message || 'Не удалось отправить ссылку');

// login: пользователя нет
this.notification.warning('Пользователь не зарегистрирован', `Аккаунта с адресом … нет. Зарегистрируйтесь, чтобы войти.`);
```

Предложение регистрации остаётся доступным: текст в уведомлении + постоянная ссылка
«Создать аккаунт» / «Зарегистрироваться» внизу формы; эта ссылка теперь передаёт email.

### Логика ответа сервера

```
POST /api/kratos/recovery  { email }
  ├─ пользователя нет   → 404 { error: { code: "EMAIL_NOT_REGISTERED", message } }
  ├─ Kratos недоступен  → проверка пропускается, обычный сценарий
  └─ пользователь есть   → создаётся recovery-флоу, письмо отправляется
```

---

## 3. Как проверено

**Сборки:**

```powershell
cd server; npx tsc --noEmit                                  # exit 0
cd ..\client; npx tsc -p tsconfig.app.json --noEmit          # exit 0
npx ng build --configuration development                     # exit 0, AOT + strictTemplates
```
`strictTemplates: true` (`client/tsconfig.json`) — шаблоны проверены по-настоящему.

**Рантайм (сервер :3000 под `tsx watch`, Kratos :4433/:4434):**

```powershell
# 1. незарегистрированный адрес
POST /api/kratos/recovery {"email":"nobody-here-999@example.com"}
→ HTTP 404
{"success":false,"error":{"code":"EMAIL_NOT_REGISTERED","message":"Пользователь с таким email не зарегистрирован."}}

# 2. зарегистрированный, ВЕРХНИЙ регистр
POST /api/kratos/recovery {"email":"User@Telemetry.Local"}
→ HTTP 200, "state":"sent_email"      (проверка пропустила)

# 3. регресс логина
POST /api/kratos/login {"email":"nobody-login-777@example.com","password":"..."}
→ HTTP 400 {"success":false,"error":{"code":"EMAIL_NOT_REGISTERED",...}}
```

**Побочный эффект проверки №2:** Kratos поставил письмо на `User@Telemetry.Local`
(домен `.local` недоставим). Это тестовый identity, вреда нет.

---

## 4. Принятые решения и почему

| Решение | Причина |
|---|---|
| Сообщения через `NzNotificationService`, не инлайн | Уточнение заказчика; так же сделано в логине, регистрации и смене пароля — единый паттерн проекта. |
| Fail-open при недоступном Kratos (`null`) | Иначе сбой аутентификации выглядел бы как «вас нет в системе». |
| `404` для незарегистрированного | Семантически верно; клиент проверяет `!r.ok` и `code`. |
| Проверка **до** создания флоу | Kratos для неизвестного адреса молча отвечает успехом, поэтому поведение меняется только у нас. |
| Регистр не проверяем отдельно | Admin API Kratos сопоставляет `credentials_identifier` без учёта регистра — проверено на стенде. Лишний код убран. |
| Проверка и в логине | Так было начато предыдущей сессией; выровнено на тот же безопасный метод и тот же вывод. |

---

## 5. Что осталось

1. **Коммит.** Все правки — в рабочем дереве, не закоммичены.
2. **Решение по перечислению пользователей.** Проверка на *входе* позволяет выяснить,
   зарегистрирован ли email. На восстановлении это оправдано задачей; на входе — спорно.
   Если не нужно: убрать блок в `POST /login` и `notification.warning` в логине.
3. **Визуальная проверка не выполнялась** — браузера нет. Проверено сборкой
   (AOT + strictTemplates) и чтением кода.
4. **Порт 4200 занят** контейнером `stats-hunter-frontend-1`, поэтому
   `npm run dev:client` не стартует. Варианты: `docker stop stats-hunter-frontend-1`
   либо `npx ng serve --port 4201` (+ согласовать `CORS_ORIGIN`).

### Сценарии для ручной проверки в браузере

1. `/recovery` + незарегистрированный email → всплывает **уведомление** (warning)
   «Пользователь не зарегистрирован», внутри формы ничего не появляется; письмо не уходит.
2. Ссылка «Создать аккаунт» внизу → `/registration?email=...`, поле email заполнено.
3. `/recovery` + зарегистрированный email → уведомлений нет, переход на `/link-sent`.
4. `/login` + незарегистрированный email → уведомление warning вместо тишины.
5. `/login` + неверный пароль → по-прежнему `notification.error('Ошибка входа', …)`.

Смотреть можно через сам сервер: он раздаёт `client/dist/browser` на
`http://localhost:3000/` (dev-режим, `SERVE_CLIENT` не выключен).

---

## 6. Как продолжить в другой сессии

Идентификатор сессии DSH:

```
session-fc3d0447-630c-4841-b10c-146280d3aab9
```

```powershell
cd C:\Users\Saturn\WebstormProjects\industrial-telemetry
dsh headless --session-id session-fc3d0447-630c-4841-b10c-146280d3aab9 "продолжай по user-data/HANDOFF_AUTH_RECOVERY.md"
```

Профиля `tui` в этой сборке нет; доступны `headless` (одна задача), `web`, `desktop`, `acp`.
Одновременно две сессии на одном `session-id` не запускать — журнал общий.
