import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ProjectsService } from '../../services/projects.service';

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    NzLayoutModule,
    NzBreadCrumbModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzIconModule,
  ],
  templateUrl: './project-create.component.html',
  styleUrl: './project-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCreateComponent {
  private readonly projectsService = inject(ProjectsService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  readonly currentYear = new Date().getFullYear();

  name = '';
  description = '';
  submitting = false;

  cancel(): void {
    this.router.navigate(['/projects']);
  }

  submit(): void {
    const name = this.name.trim();
    if (!name) return;

    this.submitting = true;
    this.projectsService.create({
      name,
      description: this.description.trim() || undefined,
    }).subscribe({
      next: () => {
        this.message.success('Проект создан');
        this.router.navigate(['/projects']);
      },
      error: (err) => {
        this.message.error(err?.error?.error?.message ?? 'Не удалось создать проект');
        this.submitting = false;
      },
    });
  }
}
