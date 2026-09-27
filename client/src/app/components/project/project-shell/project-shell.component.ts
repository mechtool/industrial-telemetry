import { Component, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { AuthService, initialsOf, primaryRole } from '../../../services/auth.service';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  count?: number;
  route?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  engineer: 'Инженер',
  operator: 'Диспетчер',
  viewer: 'Наблюдатель',
};

@Component({
  selector: 'app-project-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NzLayoutModule,
    NzIconModule,
    NzAvatarModule,
    NzBreadCrumbModule,
  ],
  templateUrl: './project-shell.component.html',
  styleUrl: './project-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectShellComponent {
  private readonly auth = inject(AuthService);

  readonly projectName = 'Холод-Логистик Север';
  readonly projectMeta = 'PRJ-1042 · Санкт-Петербург';
  readonly lastSync = '12.05.2024, 08:42';
  readonly syncStatus = 'Связь со всеми шлюзами стабильна';

  readonly navItems: NavItem[] = [
    { id: '01', label: 'Общие', icon: 'info-circle', route: './general' },
    { id: '02', label: 'Панель управления', icon: 'pie-chart', route: './dashboard' },
    { id: '03', label: 'Объекты', icon: 'apartment', count: 24 },
    { id: '04', label: 'Данные', icon: 'database', count: 6 },
    { id: '05', label: 'Шлюзы', icon: 'wifi', count: 3 },
    { id: '06', label: 'Триггеры', icon: 'thunderbolt', count: 5 },
    { id: '07', label: 'Организации', icon: 'cluster', count: 4 },
    { id: '08', label: 'Пользователи', icon: 'team', route: './users', count: 23 },
  ];

  readonly avatarInitial = computed(() => initialsOf(this.auth.currentUser()));

  readonly userName = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return 'Пользователь';
    return u.username || u.email || 'Пользователь';
  });

  readonly userCaption = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return '';
    const role = ROLE_LABELS[primaryRole(u.roles)] ?? primaryRole(u.roles);
    return u.department ? `${role} · ${u.department}` : role;
  });
}
