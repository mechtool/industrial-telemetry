import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { GatewayNewComponent } from '../gateway-new/gateway-new.component';

interface GatewayRow {
  name: string;
  ip: string;
  mac: string;
  connectionType: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Онлайн': '#0fa97e',
  'Свободен': '#1470c8',
  'Занят': '#d98a16',
  'Резерв': '#8fa6bc',
};

@Component({
  selector: 'app-gateways-list',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzSelectModule, NzModalModule],
  templateUrl: './gateways-list.component.html',
  styleUrl: './gateways-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatewaysListComponent {
  private readonly modalService = inject(NzModalService);

  readonly typeOptions = ['Все типы', 'RS485, мастер шины', 'RS485, слейв', 'TCP/IP', 'Modbus RTU'];
  readonly statusOptions = ['Все статусы', 'Онлайн', 'Свободен', 'Занят', 'Резерв'];

  readonly gateways: GatewayRow[] = [
    { name: 'GW-01 · Парнас, шкаф 3', ip: '10.20.4.11', mac: 'A4:CF:12:8B:3E:01', connectionType: 'Modbus TCP', status: 'Онлайн' },
    { name: 'GW-02 · Парнас, шкаф 7', ip: '10.20.4.12', mac: 'A4:CF:12:8B:3E:02', connectionType: 'Modbus TCP', status: 'Онлайн' },
    { name: 'GW-03 · резервный канал', ip: '10.44.2.7', mac: 'A4:CF:12:8B:3E:03', connectionType: 'MQTT/LTE', status: 'Резерв' },
    { name: 'GW-RS485-0001', ip: '192.168.10.24', mac: 'A4:CF:12:8B:3E:07', connectionType: 'RS485, мастер шины', status: 'Свободен' },
    { name: 'GW-RS485-0002', ip: '192.168.10.25', mac: 'A4:CF:12:8B:3E:08', connectionType: 'RS485, мастер шины', status: 'Занят' },
    { name: 'GW-RS485-0003', ip: '192.168.10.26', mac: 'A4:CF:12:8B:3E:09', connectionType: 'RS485, слейв', status: 'Свободен' },
  ];

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

  statusColor(status: string): string {
    return STATUS_COLORS[status] ?? '#8fa6bc';
  }
}
