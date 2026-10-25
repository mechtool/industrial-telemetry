import { Component, inject, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { AuthService, initialsOf, primaryRole } from '../../services/auth.service';
import { UserProfileComponent } from '../user-profile/user-profile.component';

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
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterOutlet,
    NzLayoutModule,
    NzMenuModule,
    NzButtonModule,
    NzIconModule,
    NzAvatarModule,
    NzModalModule,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly modalService = inject(NzModalService);

  /** Свёрнут ли левый сайдбар. */
  readonly collapsed = signal(false);

  toggleSidebar(): void {
    this.collapsed.update((value) => !value);
  }

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

  openProfile(): void {
    this.modalService.create({
      nzTitle: '',
      nzContent: UserProfileComponent,
      nzFooter: null,
      nzWidth: 840,
      nzMaskClosable: false,
      nzBodyStyle: { padding: '24px 28px' },
    });
  }
}
