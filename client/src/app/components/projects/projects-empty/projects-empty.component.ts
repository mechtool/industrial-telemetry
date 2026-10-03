import { Component, inject, OnInit, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { ProjectsUiService } from '../../../services/projects-ui.service';
import { ProjectNewComponent } from '../../project/project-new/project-new.component';

interface Template {
  icon: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-projects-empty',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzModalModule],
  templateUrl: './projects-empty.component.html',
  styleUrl: './projects-empty.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsEmptyComponent implements OnInit {
  private readonly ui = inject(ProjectsUiService);
  private readonly modalService = inject(NzModalService);

  readonly templates: Template[] = [
    { icon: 'desktop', title: 'Веб-приложение', desc: 'Дизайн-система, роли пользователей и основные сценарии.' },
    { icon: 'mobile', title: 'Мобильное приложение', desc: 'Навигация, состояния экранов и нативные паттерны.' },
    { icon: 'experiment', title: 'Исследование', desc: 'Материалы интервью, гипотезы и выводы по продукту.' },
  ];

  readonly activeFilter = computed(() => this.ui.activeFilter());
  readonly activeFilterCount = computed(
    () => this.ui.filters.find((f) => f.label === this.ui.activeFilter())?.count ?? 0,
  );

  ngOnInit(): void {
    this.ui.isProjectView.set(false);
    this.ui.subtitle.set('Выбранный фильтр не содержит проектов');
    this.ui.activeFilter.set('Архив');
    this.ui.shownCount.set(0);
  }

  openNewProject(): void {
    this.modalService.create({
      nzTitle: '',
      nzContent: ProjectNewComponent,
      nzFooter: null,
      nzWidth: 840,
      nzMaskClosable: false,
      nzBodyStyle: { padding: '24px 28px' },
    });
  }
}
