import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectsUiService } from '../../../services/projects-ui.service';
import { ProjectsService } from '../../../services/projects.service';
import { tap } from 'rxjs/operators';

const STATUS_COLORS: Record<string, string> = {
  'Новый': '#0fa97e',
  'В работе': '#1e88e5',
  'Приостановлен': '#d98a16',
  'Архив': '#8fa6bc',
  'Черновик': '#8fa6bc',
};

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './projects-list.component.html',
  styleUrl: './projects-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsListComponent implements OnInit {
  readonly ui = inject(ProjectsUiService);
  private readonly projectsService = inject(ProjectsService);

  readonly projects$ = this.projectsService.projects$.pipe(
    tap((list) => {
      this.ui.totalCount.set(list.length);
      this.ui.shownCount.set(list.length);
    }),
  );

  ngOnInit(): void {
    this.ui.isProjectView.set(false);
    this.ui.subtitle.set('Все проекты · сортировка по дате создания');
    this.ui.activeFilter.set('Все');
  }

  statusColor(status: string): string {
    return STATUS_COLORS[status] ?? '#8fa6bc';
  }
}
