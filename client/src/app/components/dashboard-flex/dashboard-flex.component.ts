import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { KratosService } from '../../services/kratos.service';

@Component({
  selector: 'app-dashboard-flex',
  standalone: true,
  imports: [
    RouterLink,
    NzLayoutModule,
    NzAvatarModule,
    NzTooltipModule,
  ],
  templateUrl: './dashboard-flex.component.html',
  styleUrl: './dashboard-flex.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardFlexComponent {
  private readonly kratos = inject(KratosService);

  /** Порядковые номера плиток, в дальнейшем — главы приложения по роли */
  readonly tiles = Array.from({ length: 10 }, (_, i) => i + 1);

  get userName(): string {
    const u = this.kratos.currentUser();
    return u ? u.username : 'Name';
  }

  get userInitial(): string {
    return this.userName.charAt(0).toUpperCase() || '?';
  }
}
