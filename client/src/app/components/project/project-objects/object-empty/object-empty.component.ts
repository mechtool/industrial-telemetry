import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { ObjectNewComponent } from '../object-new/object-new.component';

@Component({
  selector: 'app-object-empty',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzModalModule],
  templateUrl: './object-empty.component.html',
  styleUrl: './object-empty.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectEmptyComponent {
  private readonly modalService = inject(NzModalService);

  openNewObject(): void {
    this.modalService.create({
      nzTitle: '',
      nzContent: ObjectNewComponent,
      nzFooter: null,
      nzWidth: 760,
      nzMaskClosable: false,
      nzBodyStyle: { padding: '24px 28px' },
    });
  }
}
