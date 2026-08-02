import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { KratosService } from '../../services/kratos.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    TagModule,
    ButtonModule,
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
  readonly kratos = inject(KratosService);
  readonly currentYear = new Date().getFullYear();

  get user() {
    return this.kratos.currentUser();
  }

  get initial(): string {
    const u = this.user;
    return u ? u.username.charAt(0).toUpperCase() : '?';
  }
}
