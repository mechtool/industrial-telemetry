import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { OrganizationNewComponent } from '../organization-new/organization-new.component';

@Component({
  selector: 'app-organizations-empty',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzModalModule],
  templateUrl: './organizations-empty.component.html',
  styleUrl: './organizations-empty.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationsEmptyComponent {
  private readonly modalService = inject(NzModalService);

  openNewOrganization(): void {
    this.modalService.create({
      nzTitle: '',
      nzContent: OrganizationNewComponent,
      nzFooter: null,
      nzWidth: 840,
      nzMaskClosable: false,
      nzBodyStyle: { padding: '24px 28px' },
    });
  }
}
