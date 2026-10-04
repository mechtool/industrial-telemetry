import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectsUiService } from '../../../services/projects-ui.service';
import { ProjectsService } from '../../../services/projects.service';
import { tap } from 'rxjs/operators';

const STATUS_META: Record<string, { color: string; bg: string }> = {
  'Новый': { color: '#0b8463', bg: '#e6f6f1' },
  'В работе': { color: '#1470c8', bg: '#eaf4fe' },
  'Приостановлен': { color: '#b06f0c', bg: '#fcf1e2' },
  'Архив': { color: '#5b7590', bg: '#f0f4f8' },
  'Черновик': { color: '#5b7590', bg: '#f0f4f8' },
};

@Component({
  selector: 'app-projects-tiles',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './projects-tiles.component.html',
  styleUrl: './projects-tiles.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsTilesComponent implements OnInit {
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
    this.ui.subtitle.set('Все проекты · плитки');
    this.ui.activeFilter.set('Все');
  }

  statusMeta(status: string): { color: string; bg: string } {
    return STATUS_META[status] ?? { color: '#5b7590', bg: '#f0f4f8' };
  }
}
