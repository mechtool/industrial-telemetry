import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { ProjectsUiService } from '../../../services/projects-ui.service';

interface ListProject {
  code: string;
  name: string;
  status: string;
  progress: number;
  team: string[];
  teamExtra: number;
  deadline: string;
}

const STATUS_COLORS: Record<string, string> = {
  'В работе': '#1e88e5',
  'На проверке': '#d98a16',
  'Завершён': '#0fa97e',
  'На паузе': '#8fa6bc',
  'Черновик': '#8fa6bc',
};

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzAvatarModule],
  templateUrl: './projects-list.component.html',
  styleUrl: './projects-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsListComponent implements OnInit {
  private readonly ui = inject(ProjectsUiService);

  readonly projects: ListProject[] = [
    { code: 'PRJ-001', name: 'Редизайн корпоративного портала', status: 'В работе', progress: 72, team: ['АК', 'МС', 'ИВ'], teamExtra: 2, deadline: '15 авг 2025' },
    { code: 'PRJ-002', name: 'Мобильное приложение банка', status: 'На проверке', progress: 90, team: ['ДП', 'ОК'], teamExtra: 4, deadline: '30 сен 2025' },
    { code: 'PRJ-003', name: 'CRM-система для отдела продаж', status: 'В работе', progress: 45, team: ['ЕК', 'НЛ'], teamExtra: 1, deadline: '12 дек 2025' },
    { code: 'PRJ-004', name: 'Аналитическая платформа данных', status: 'Завершён', progress: 100, team: ['СМ', 'ВН'], teamExtra: 3, deadline: '01 мар 2025' },
    { code: 'PRJ-005', name: 'Система управления складом', status: 'В работе', progress: 38, team: ['РФ', 'АЮ', 'ИВ'], teamExtra: 1, deadline: '20 окт 2025' },
    { code: 'PRJ-006', name: 'Интеграция платёжного шлюза', status: 'На проверке', progress: 85, team: ['ЛМ', 'ДС'], teamExtra: 4, deadline: '05 ноя 2025' },
    { code: 'PRJ-007', name: 'Портал самообслуживания HR', status: 'Завершён', progress: 100, team: ['КВ', 'ТН'], teamExtra: 1, deadline: '15 июн 2025' },
    { code: 'PRJ-008', name: 'Переход инфраструктуры в облако', status: 'В работе', progress: 61, team: ['ПА', 'СЮ'], teamExtra: 3, deadline: '28 фев 2026' },
    { code: 'PRJ-009', name: 'Разработка мобильного кошелька', status: 'На проверке', progress: 77, team: ['ЕМ', 'НБ', 'ИВ'], teamExtra: 2, deadline: '10 янв 2026' },
  ];

  ngOnInit(): void {
    this.ui.subtitle.set('6 активных проектов · сортировка по ближайшему сроку');
    this.ui.activeFilter.set('Все');
    this.ui.shownCount.set(6);
  }

  statusColor(status: string): string {
    return STATUS_COLORS[status] ?? '#8fa6bc';
  }
}
