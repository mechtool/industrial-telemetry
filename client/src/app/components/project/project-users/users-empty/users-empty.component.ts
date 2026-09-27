import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { UserNewComponent } from '../user-new/user-new.component';

@Component({
  selector: 'app-users-empty',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzModalModule],
  templateUrl: './users-empty.component.html',
  styleUrl: './users-empty.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersEmptyComponent {
  private readonly modalService = inject(NzModalService);

  openNewUser(): void {
    this.modalService.create({
      nzTitle: '',
      nzContent: UserNewComponent,
      nzFooter: null,
      nzWidth: 760,
      nzMaskClosable: false,
      nzBodyStyle: { padding: '24px 28px' },
    });
  }
}
