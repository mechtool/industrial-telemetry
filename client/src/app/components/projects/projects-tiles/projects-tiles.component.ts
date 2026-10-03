import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { ProjectsUiService } from '../../../services/projects-ui.service';

interface TileProject {
  status: string;
  industry: string;
  code: string;
  title: string;
  ownerInitials: string;
  ownerName: string;
  customer: string;
  deadline: string;
  tasksDone: number;
  tasksTotal: number;
  teamCount: number;
  progress: number;
  tags: string;
}

const STATUS_META: Record<string, { color: string; bg: string }> = {
  'В работе': { color: '#1470c8', bg: '#eaf4fe' },
  'На проверке': { color: '#b06f0c', bg: '#fcf1e2' },
  'Завершён': { color: '#0b8463', bg: '#e6f6f1' },
  'Черновик': { color: '#5b7590', bg: '#f0f4f8' },
  'На паузе': { color: '#b5453d', bg: '#fbeceb' },
};

@Component({
  selector: 'app-projects-tiles',
  standalone: true,
  imports: [CommonModule, RouterLink, NzButtonModule, NzIconModule, NzAvatarModule],
  templateUrl: './projects-tiles.component.html',
  styleUrl: './projects-tiles.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsTilesComponent implements OnInit {
  private readonly ui = inject(ProjectsUiService);

  readonly projects: TileProject[] = [
    { status: 'В работе', industry: 'ГОССЕКТОР', code: 'PRJ-2418', title: 'Платформа CityPass', ownerInitials: 'АК', ownerName: 'А. Кузнецов', customer: 'Городская администрация', deadline: '12 мар — 28 июн', tasksDone: 24, tasksTotal: 38, teamCount: 8, progress: 64, tags: 'ГОССЕКТОР · МОБИЛЬНОЕ' },
    { status: 'На проверке', industry: 'ЭНЕРГЕТИКА', code: 'PRJ-2390', title: 'Личный кабинет «Северэнерго»', ownerInitials: 'МИ', ownerName: 'М. Иванова', customer: 'ПАО «Северэнерго»', deadline: '4 фев — 30 май', tasksDone: 51, tasksTotal: 64, teamCount: 6, progress: 80, tags: 'ЭНЕРГЕТИКА · ВЕБ' },
    { status: 'В работе', industry: 'МЕДИЦИНА', code: 'PRJ-2377', title: 'CRM для сети клиник «Медион»', ownerInitials: 'ДС', ownerName: 'Д. Соколов', customer: 'Сеть клиник «Медион»', deadline: '20 янв — 15 сен', tasksDone: 37, tasksTotal: 90, teamCount: 11, progress: 41, tags: 'МЕДИЦИНА · ИНТЕГРАЦИИ' },
    { status: 'Черновик', industry: 'E-COMMERCE', code: 'PRJ-2352', title: 'Редизайн маркетплейса «Технополис»', ownerInitials: 'ЕО', ownerName: 'Е. Орлова', customer: 'Маркетплейс «Технополис»', deadline: '5 мая — 1 ноя', tasksDone: 6, tasksTotal: 42, teamCount: 4, progress: 14, tags: 'E-COMMERCE · ДИЗАЙН' },
    { status: 'Завершён', industry: 'АГРО · МОБИЛЬНОЕ', code: 'PRJ-2318', title: 'Приложение «Фермер24»', ownerInitials: 'ИП', ownerName: 'И. Петров', customer: 'Агрохолдинг «Нива»', deadline: '8 ноя — 12 апр', tasksDone: 88, tasksTotal: 88, teamCount: 9, progress: 100, tags: 'АГРО · МОБИЛЬНОЕ' },
    { status: 'На паузе', industry: 'ЛОГИСТИКА · ВЕБ', code: 'PRJ-2295', title: 'Портал партнёров «ЛогистикПро»', ownerInitials: 'СВ', ownerName: 'С. Волкова', customer: 'ГК «ЛогистикПро»', deadline: '3 фев — 20 дек', tasksDone: 29, tasksTotal: 74, teamCount: 7, progress: 33, tags: 'ЛОГИСТИКА · ВЕБ' },
  ];

  ngOnInit(): void {
    this.ui.isProjectView.set(false);
    this.ui.subtitle.set('18 проектов · 7 в работе · обновлено 5 минут назад');
    this.ui.activeFilter.set('Все');
    this.ui.shownCount.set(6);
  }

  statusMeta(status: string): { color: string; bg: string } {
    return STATUS_META[status] ?? { color: '#5b7590', bg: '#f0f4f8' };
  }
}
