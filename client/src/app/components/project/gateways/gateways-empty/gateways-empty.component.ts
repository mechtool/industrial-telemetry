import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { GatewayNewComponent } from '../gateway-new/gateway-new.component';

@Component({
  selector: 'app-gateways-empty',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzModalModule],
  templateUrl: './gateways-empty.component.html',
  styleUrl: './gateways-empty.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatewaysEmptyComponent {
  private readonly modalService = inject(NzModalService);

  openNewGateway(): void {
    this.modalService.create({
      nzTitle: '',
      nzContent: GatewayNewComponent,
      nzFooter: null,
      nzWidth: 840,
      nzMaskClosable: false,
      nzBodyStyle: { padding: '24px 28px' },
    });
  }
}
