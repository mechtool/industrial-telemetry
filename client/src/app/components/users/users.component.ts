import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { KratosService } from '../../services/kratos.service';
import { UsersService, AdminUser } from '../../services/users.service';

interface RoleRow {
  name: string;
  label: string;
  description: string;
}

interface RoleOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    NzLayoutModule,
    NzMenuModule,
    NzBreadCrumbModule,
    NzIconModule,
    NzAvatarModule,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzSelectModule,
    NzEmptyModule,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent implements OnInit {
  private readonly kratos = inject(KratosService);
  private readonly usersService = inject(UsersService);
  private readonly message = inject(NzMessageService);

  readonly currentYear = new Date().getFullYear();

  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly roleOptions: RoleOption[] = [
    { label: 'Администратор', value: 'admin' },
    { label: 'Инженер', value: 'engineer' },
    { label: 'Оператор', value: 'operator' },
    { label: 'Просмотр', value: 'viewer' },
  ];

  readonly roles: RoleRow[] = [
    { name: 'admin', label: 'Администратор', description: 'Полный доступ ко всем разделам' },
    { name: 'engineer', label: 'Инженер', description: 'Просмотр и настройка телеметрии' },
    { name: 'operator', label: 'Оператор', description: 'Только просмотр данных' },
    { name: 'viewer', label: 'Просмотр', description: 'Самый низкий уровень доступа — только просмотр' },
  ];

  get avatarInitial(): string {
    const user = this.kratos.currentUser();
    return user ? user.username.charAt(0).toUpperCase() : 'U';
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.usersService.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error?.message ?? 'Не удалось загрузить пользователей');
        this.loading.set(false);
      },
    });
  }

  changeRoles(user: AdminUser, roles: string[]): void {
    const same = roles.length === user.roles.length && roles.every((r) => user.roles.includes(r));
    if (same || roles.length === 0) return;

    this.usersService.updateRoles(user.id, roles).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
        this.message.success(`Роли пользователя «${updated.username}» изменены`);
      },
      error: (err) => {
        this.message.error(err?.error?.error?.message ?? 'Не удалось изменить роли');
        this.load();
      },
    });
  }
}
