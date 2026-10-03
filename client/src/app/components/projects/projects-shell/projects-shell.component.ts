import { Component, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { AuthService, initialsOf, primaryRole } from '../../../services/auth.service';
import { ProjectsUiService } from '../../../services/projects-ui.service';
import { ProjectNewComponent } from '../../project/project-new/project-new.component';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  engineer: 'Инженер',
  operator: 'Диспетчер',
  viewer: 'Наблюдатель',
};

interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
}

@Component({
  selector: 'app-projects-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NzLayoutModule,
    NzMenuModule,
    NzButtonModule,
    NzIconModule,
    NzAvatarModule,
    NzBreadCrumbModule,
    NzModalModule,
  ],
  templateUrl: './projects-shell.component.html',
  styleUrl: './projects-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsShellComponent {
  private readonly auth = inject(AuthService);
  private readonly modalService = inject(NzModalService);
  readonly ui = inject(ProjectsUiService);

  readonly navItems: NavItem[] = [
    { id: '01', label: 'Проекты', icon: 'folder', route: '/projects' },
    { id: '02', label: 'Пользователи', icon: 'team' },
    { id: '03', label: 'Журналы', icon: 'file-text' },
    { id: '04', label: 'Настройки', icon: 'setting', route: '/settings' },
    { id: '05', label: 'Протоколы', icon: 'profile' },
    { id: '06', label: 'Чаты', icon: 'message' },
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
