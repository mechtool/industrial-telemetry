import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { KratosService } from '../../services/kratos.service';
import { ProjectsService, ProjectStatus } from '../../services/projects.service';

const STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  active: { label: 'Активный', color: 'green' },
  paused: { label: 'На паузе', color: 'orange' },
  archived: { label: 'Архив', color: 'default' },
};

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NzLayoutModule,
    NzMenuModule,
    NzBreadCrumbModule,
    NzIconModule,
    NzAvatarModule,
    NzCardModule,
    NzButtonModule,
    NzTagModule,
    NzEmptyModule,
    NzSkeletonModule,
  ],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsComponent implements OnInit {
  private readonly kratos = inject(KratosService);
  readonly projectsService = inject(ProjectsService);

  readonly currentYear = new Date().getFullYear();

  get avatarInitial(): string {
    const user = this.kratos.currentUser();
    return user ? user.username.charAt(0).toUpperCase() : 'U';
  }

  get username(): string {
    return this.kratos.currentUser()?.username ?? '';
  }

  ngOnInit(): void {
    this.projectsService.load();
  }

  statusMeta(status: ProjectStatus): { label: string; color: string } {
    return STATUS_META[status];
  }
}
