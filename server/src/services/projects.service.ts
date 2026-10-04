import { randomUUID } from 'node:crypto';

export interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  monitoringType: string;
  address: string;
  phone: string;
  workMode: string;
  manager: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  code: string;
  name: string;
  status: string;
  monitoringType: string;
  address?: string;
  phone?: string;
  workMode?: string;
  manager?: string;
  role?: string;
}

/**
 * In-memory хранилище проектов (dev-заглушка).
 *
 * TODO(persistence): заменить на PostgreSQL — таблица `projects`
 * с полем `owner_id` (Kratos identity id) и CRUD-эндпоинтами.
 */
const store = new Map<string, Project[]>();

function seedProjects(userId: string): Project[] {
  const ts = '2026-09-10T09:15:00.000Z';
  return [
    {
      id: `${userId}:conveyor`,
      code: '1000000000000001',
      name: 'Цех №1 — Конвейер',
      status: 'В работе',
      monitoringType: 'Статический',
      address: 'г Санкт-Петербург, ул Промышленная, д 1',
      phone: '+7 (812) 000-00-01',
      workMode: 'Круглосуточно',
      manager: 'Иванов И. И.',
      role: 'Инженер',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: `${userId}:boiler`,
      code: '1000000000000002',
      name: 'Котельная',
      status: 'В работе',
      monitoringType: 'Динамический',
      address: 'г Москва, ул Заводская, д 5',
      phone: '+7 (495) 000-00-02',
      workMode: 'пн–пт',
      manager: 'Петров П. П.',
      role: 'Технолог',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: `${userId}:cold-storage`,
      code: '1000000000000003',
      name: 'Склад — Холодильники',
      status: 'Приостановлен',
      monitoringType: 'Статический',
      address: 'г Казань, ул Складская, д 10',
      phone: '+7 (843) 000-00-03',
      workMode: 'по расписанию',
      manager: 'Сидоров С. С.',
      role: 'Диспетчер',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: `${userId}:water-treatment`,
      code: '1000000000000004',
      name: 'Водоподготовка',
      status: 'В работе',
      monitoringType: 'Мобильный',
      address: 'г Екатеринбург, ул Насосная, д 3',
      phone: '+7 (343) 000-00-04',
      workMode: 'Круглосуточно',
      manager: 'Кузнецов К. К.',
      role: 'Инженер',
      createdAt: ts,
      updatedAt: ts,
    },
  ];
}

class ProjectsService {
  /** Вернуть проекты текущего пользователя (по Kratos identity id). */
  getForUser(userId: string): Project[] {
    if (!store.has(userId)) {
      store.set(userId, seedProjects(userId));
    }
    return store.get(userId)!;
  }

  /** Создать проект для пользователя (новый проект встаёт первым). */
  createForUser(userId: string, input: CreateProjectInput): Project {
    const projects = this.getForUser(userId);
    const now = new Date().toISOString();
    const project: Project = {
      id: `${userId}:${randomUUID()}`,
      code: input.code,
      name: input.name,
      status: input.status || 'Новый',
      monitoringType: input.monitoringType || '',
      address: input.address || '',
      phone: input.phone || '',
      workMode: input.workMode || '',
      manager: input.manager || '',
      role: input.role || '',
      createdAt: now,
      updatedAt: now,
    };
    projects.unshift(project);
    return project;
  }
}

// Синглтон
export const projectsService = new ProjectsService();
