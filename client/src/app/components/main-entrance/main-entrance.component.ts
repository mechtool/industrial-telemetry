import { Component, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { AuthService, initialsOf, primaryRole } from '../../services/auth.service';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
}

interface Benefit {
  icon: string;
  title: string;
  desc: string;
}

interface Metric {
  label: string;
  value: string;
  note: string;
  icon: string;
  color: string;
  bg: string;
}

interface Stat {
  value: string;
  label: string;
}

interface EventItem {
  text: string;
  time: string;
  color: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  engineer: 'Инженер',
  operator: 'Диспетчер',
  viewer: 'Наблюдатель',
};

@Component({
  selector: 'app-main-entrance',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NzLayoutModule,
    NzMenuModule,
    NzButtonModule,
    NzIconModule,
    NzAvatarModule,
  ],
  templateUrl: './main-entrance.component.html',
  styleUrl: './main-entrance.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainEntranceComponent {
  private readonly auth = inject(AuthService);

  readonly navItems: NavItem[] = [
    { id: '01', label: 'Проекты', icon: 'folder', route: '/projects' },
    { id: '02', label: 'Пользователи', icon: 'team', route: '/users' },
    { id: '03', label: 'Журналы', icon: 'file-text' },
    { id: '04', label: 'Настройки', icon: 'setting', route: '/settings' },
    { id: '05', label: 'Протоколы', icon: 'profile' },
    { id: '06', label: 'Чаты', icon: 'message' },
  ];

  readonly benefits: Benefit[] = [
    { icon: 'thunderbolt', title: 'Мгновенные уведомления', desc: 'Алерты при отклонении температуры' },
    { icon: 'bar-chart', title: 'Аналитика и отчёты', desc: 'Графики, история и журналы событий' },
    { icon: 'safety-certificate', title: 'Надёжность и защита данных', desc: 'Шифрование и резервирование 24/7' },
  ];

  readonly metrics: Metric[] = [
    { label: 'Проекты', value: '12', note: 'Активных проектов', icon: 'folder', color: '#1e88e5', bg: '#eaf4fe' },
    { label: 'Пользователи', value: '38', note: 'Зарегистрировано в системе', icon: 'team', color: '#0fa97e', bg: '#e6f6f1' },
    { label: 'Журналы', value: '1 247', note: 'Записей за текущий месяц', icon: 'file-text', color: '#d98a16', bg: '#fcf1e2' },
    { label: 'Протоколы', value: '96', note: 'Документов выгружено', icon: 'profile', color: '#1470c8', bg: '#eaf4fe' },
  ];

  readonly efficiencyStats: Stat[] = [
    { value: '99.7%', label: 'Аптайм системы' },
    { value: '< 2 мин', label: 'Время реакции' },
    { value: '−34%', label: 'Потерь продукции' },
  ];

  readonly efficiencyDesc =
    'Система мониторинга CRYOMON помогает предприятиям сократить простои оборудования, ' +
    'снизить затраты на техническое обслуживание и избежать потерь от сбоев в работе ' +
    'холодильных установок.';

  readonly events: EventItem[] = [
    { text: 'Холод-Логистик: норма', time: 'Сегодня, 08:42', color: '#0fa97e' },
    { text: 'АВТ-Склад: отклонение +2°C', time: 'Вчера, 23:14', color: '#d98a16' },
    { text: 'Фрим-Экспресс: шлюз офлайн', time: '11.05.2024, 17:05', color: '#d9574e' },
  ];

  readonly currentYear = new Date().getFullYear();

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
