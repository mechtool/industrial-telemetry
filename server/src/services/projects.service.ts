import { randomUUID } from 'node:crypto';

export type ProjectStatus = 'active' | 'paused' | 'archived';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

/**
 * In-memory хранилище проектов (dev-заглушка).
 *
 * TODO(persistence): заменить на PostgreSQL — таблица `projects`
 * с полем `owner_id` (Kratos identity id) и CRUD-эндпоинтами.
 */
const store = new Map<string, Project[]>();

function seedProjects(userId: string): Project[] {
  return [
    {
      id: `${userId}:conveyor`,
      name: 'Цех №1 — Конвейер',
      description: 'Мониторинг конвейерной линии',
      status: 'active',
      updatedAt: '2026-09-10T09:15:00.000Z',
    },
    {
      id: `${userId}:boiler`,
      name: 'Котельная',
      description: 'Датчики температуры и давления',
      status: 'active',
      updatedAt: '2026-09-08T16:40:00.000Z',
    },
    {
      id: `${userId}:cold-storage`,
      name: 'Склад — Холодильники',
      description: 'Контроль температуры хранения',
      status: 'paused',
      updatedAt: '2026-09-01T11:05:00.000Z',
    },
    {
      id: `${userId}:water-treatment`,
      name: 'Водоподготовка',
      description: 'Насосы и уровни резервуаров',
      status: 'active',
      updatedAt: '2026-08-28T08:20:00.000Z',
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

  /** Создать проект для пользователя. */
  createForUser(userId: string, input: CreateProjectInput): Project {
    const projects = this.getForUser(userId);
    const project: Project = {
      id: `${userId}:${randomUUID()}`,
      name: input.name,
      description: input.description,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    projects.unshift(project);
    return project;
  }
}

// Синглтон
export const projectsService = new ProjectsService();
