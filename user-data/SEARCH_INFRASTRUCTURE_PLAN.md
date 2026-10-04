# Industrial Telemetry — Поисковая инфраструктура

**Дата:** 2026-10-04
**Статус:** план согласован, к реализации не приступали

> План построения поисковой инфраструктуры всего приложения: единый идентификатор пользователя → персистентность → индексы → серверный поиск → клиент. Фактическое состояние сверено с кодом (`server/src`, `client/src`, `kratos/`, `keto/`, `docker-compose*.yml`).

---

## 0. Исходное состояние (факты из кода)

### Идентификатор пользователя
- Уникальный идентификатор **уже существует** — это `identity.id`, UUID, который генерирует **Ory Kratos** при регистрации (self-service flow). Приложение его не придумывает.
- Регистрация: клиент → `POST /api/kratos/registration` (`server/src/routes/kratos.routes.ts`) → Kratos `/self-service/registration`. Отправляются `email`, `username`, `password`.
- Сервер читает идентификатор из ответа: `result.identity.id` (fallback `result.session.identity.id`) и использует его как `subject_id` в Keto — сразу назначает роль `viewer`.
- Дубль: webhook `kratos/webhook-registration.jsonnet` берёт `ctx.identity.id` и шлёт в `POST /api/webhooks/registration` → `ketoService.assignRole(identityId, Roles.VIEWER)`.
- «Реквизиты» (traits) пользователя — `kratos/identity.schema.json`: `email`, `username`, `department` (`additionalProperties: false`). **Идентификатор не хранится как поле внутри traits** — он и есть первичный ключ Identity.
- Отдельной прикладной таблицы пользователей нет: `usersService.list()` читает Kratos Admin API и джойнит роли из Keto.

### Проекты
- `server/src/services/projects.service.ts` — in-memory `Map<string, Project[]>`; ключ = `userId` (Kratos `identity.id`).
- `getForUser(userId)` и `createForUser(userId, input)` уже изолируют проекты по владельцу. ID проекта = `${userId}:${randomUUID()}`.
- `server/src/routes/projects.routes.ts` берёт `req.user.id` (middleware `kratosAuth` кладёт `session.identity.id`).
- В коде стоит `TODO(persistence)`: заменить на PostgreSQL, таблица `projects` с полем `owner_id`.
- Клиент: `projects.service.ts` тянет весь список и фильтрует локально; `projects-ui.service.ts` содержит **захардкоженные** счётчики фильтров (`count: 18/7/3/6/2/0`).

### Вывод
Идентификатор есть и уже является ключом владения проектами, но персистентности и поисковой инфраструктуры нет. Второй идентификатор заводить не нужно.

---

## 1. Принципы

1. **Единый канонический идентификатор** — Kratos `identity.id` (UUID) во всех таблицах. Поле `owner_id` (создатель), позже `created_by`/`updated_by`. Второго «внутреннего» user id не заводим.
2. **Email не ключ** — в Kratos он может меняться; `identity.id` неизменен.
3. **Доступ скоупится на сервере, а не на клиенте.** Каждый поисковый запрос всегда получает `WHERE owner_id = $currentUser` (`req.user.id`). Клиентские фильтры — только поверх этого скоупа. Гарантия кладётся в механизм (общий метод в service-слое), а не в дисциплину.
4. **Источник истины для ролей** — Keto; `owner_id` решает владение, доступ решает Keto.
5. **Простые решения раньше сложных.** PostgreSQL (trigram/FTS) достаточно; внешний поисковик — только при реальной потребности.

---

## 2. Фазы

### Фаза 0 — Единый идентификатор (без новых сущностей)
- Фиксируем `identity.id` как единственный ключ владения и поиска во всех будущих таблицах.
- Не дублируем id в traits Kratos (не создаём второй источник истины).
- Если понадобятся расширенные «реквизиты» сверх traits — отдельная таблица `users` с ключом `identity_id` (не сейчас).

### Фаза 1 — Персистентность
- Отдельная БД приложения (не БД Kratos/Keto). PostgreSQL 16 (образ уже используется для kratos-db).
- Заменяем `Map` в `projects.service.ts` на таблицу `projects`.
- Миграции — версионированные SQL (паттерн уже есть у Kratos/Keto через `migrate`).
- Таблицы по мере роста: `projects`, затем `gateways`, `objects`, при необходимости `users` (`identity_id`).

**Проекция таблицы `projects` (черновик):**

```sql
CREATE TABLE projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL,            -- Kratos identity.id
  code          text NOT NULL,
  name          text NOT NULL,
  status        text NOT NULL DEFAULT 'Новый',
  monitoring_type text NOT NULL DEFAULT '',
  address       text NOT NULL DEFAULT '',
  phone         text NOT NULL DEFAULT '',
  work_mode     text NOT NULL DEFAULT '',
  manager       text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

> `owner_id` — логический FK на Kratos Identity (та в другой БД), реального `REFERENCES` нет — обычная индексированная колонка. Если позже Kratos и приложение окажутся в одном кластере — можно усилить.

### Фаза 2 — Индексы под поиск
- `CREATE INDEX projects_owner_id_idx ON projects (owner_id);` — точный скоупинг «только мои проекты».
- Уникальность кода:
  - глобально: `UNIQUE (code)`, либо
  - в рамках пользователя: `UNIQUE (owner_id, code)` — решить при реализации.
- Текстовый поиск (`name`, `address`, `manager`, `phone`):
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
  - GIN-индексы: `gin_trgm_ops` на искомых колонках.
  - Запросы через `ILIKE '%...%'` / `similarity(...)`.
- Позже (при необходимости релевантности): колонка `search_vector tsvector` + GIN с русской конфигурацией FTS, генератор при записи, триггер/вычисление на стороне приложения.

### Фаза 3 — Доступ-скоупинг (главный архитектурный принцип)
- Service-слой всегда дополняет запрос `WHERE owner_id = $currentUser`; `req.user.id` приходит из `kratosAuth`.
- Клиент не может запросить чужие проекты: даже если подделать фильтр, SQL-скоуп не изменится.
- Когда появится совместный доступ (несколько пользователей на проект):
  - `owner_id` остаётся для создателя;
  - доступ решается Keto: namespace `Project`, object = `project_id`, relation = `member/editor/admin`, subject = `identity.id`;
  - поисковый эндпоинт резолвит «проекты, к которым есть доступ» — через membership-таблицу либо Keto expansion.
- Сейчас модель single-owner; это следующий шаг.

### Фаза 4 — API
- Единый контракт списка вместо фиксированного `GET /api/projects`.
- Параметры: `q` (текст), `status`, `monitoringType`, `sort`, `page`, `limit`.
- Ответ — стабильный конверт:

```json
{
  "success": true,
  "data": [ /* Project[] */ ],
  "pagination": { "total": 42, "page": 1, "pageSize": 10 }
}
```

- Фасеты с количеством (сейчас захардкожены в `projects-ui.service.ts`) отдаёт сервер: `GET /api/projects/facets` либо в теле списка.

### Фаза 5 — Клиент (Angular)
- `ProjectsService` переключается на серверный поиск:
  - debounce: `debounceTime` + `distinctUntilChanged` + `switchMap` (отмена устаревших запросов);
  - кэш `shareReplay`, инвалидация после create/update.
- `ProjectsUiService` читает фильтры и счётчики из API, а не из констант.

### Фаза 6 — Масштабирование (не сейчас)
- Postgres с trigram/FTS тянет миллионы строк.
- Внешний поисковик (OpenSearch / Meilisearch / Elasticsearch) — только при реальной потребности: фасеты на больших объёмах, релевантность, многоязычие.

---

## 3. Порядок работ (приоритет)

1. Владелец-скоупинг через `owner_id` + PostgreSQL + индексы.
2. Серверный поиск с параметрами и фасетами.
3. Клиентский debounce-поиск и инвалидация.
4. (Позже) совместный доступ через Keto и, при необходимости, внешний поисковик.

---

## 4. Критерии готовности (на фазу)

- **Фаза 1:** проекты переживают рестарт сервера; в БД есть `owner_id`; создание/чтение по владельцу работают.
- **Фаза 2:** поиск по подстроке (`q`) с кириллицей даёт ожидаемые результаты; `owner_id` покрыт индексом.
- **Фаза 3:** запрос с подделанным/чужим фильтром не возвращает чужие проекты.
- **Фаза 4:** API возвращает `pagination` и фасеты; клиент больше не полагается на захардкоженные счётчики.
- **Фаза 5:** ввод в поиск не «дергает» запросы на каждый символ; список обновляется после создания проекта.

---

## 5. Затрагиваемые файлы (ориентир)

- `server/src/services/projects.service.ts` — персистентность + поиск.
- `server/src/routes/projects.routes.ts` — параметры `q`/фильтры/пагинация/фасеты.
- `server/src/config/index.ts` — конфиг подключения к БД приложения.
- `server/src/index.ts` — инициализация БД/пула при старте.
- `client/src/app/services/projects.service.ts` — серверный поиск с debounce.
- `client/src/app/services/projects-ui.service.ts` — фасеты из API.
- Новые: SQL-миграции, модуль БД (пул/запросы).

---

## 6. Открытые вопросы (решить при реализации)

- Уникальность `code`: глобально или в рамках владельца?
- Фасеты: отдельный эндпоинт или часть ответа списка?
- Нужна ли сейчас таблица `users` (расширенные реквизиты) или Kratos traits достаточно?
- Текстовый поиск: стартуем с `pg_trgm` или сразу `tsvector` FTS?
