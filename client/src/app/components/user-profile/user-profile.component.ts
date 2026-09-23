import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { AuthService, initialsOf } from '../../services/auth.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NzTagModule,
    NzButtonModule,
    NzLayoutModule,
    NzBreadCrumbModule,
    NzIconModule,
    NzDescriptionsModule,
    NzAvatarModule,
  ],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent {
  readonly auth = inject(AuthService);
  readonly currentYear = new Date().getFullYear();

  get user() {
    return this.auth.currentUser();
  }

  get initial(): string {
    return initialsOf(this.user);
  }

  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      admin: 'Администратор',
      engineer: 'Инженер',
      operator: 'Оператор',
      viewer: 'Просмотр',
    };
    return labels[role] ?? role;
  }
}
