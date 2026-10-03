import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzModalRef } from 'ng-zorro-antd/modal';

interface TokenRow {
  token: string;
  provider: string;
}

@Component({
  selector: 'app-gateway-new',
  standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzSelectModule, NzSwitchModule],
  templateUrl: './gateway-new.component.html',
  styleUrl: './gateway-new.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatewayNewComponent {
  private readonly modalRef = inject(NzModalRef);

  readonly connectionTypeOptions = ['RS485, мастер шины', 'RS485, слейв', 'TCP/IP', 'Modbus RTU'];
  readonly protocolOptions = ['MQTT 3.1.1', 'MQTT 5.0', 'HTTP'];
  readonly statusOptions = ['Свободен', 'Занят', 'Резерв'];

  nat = false;
  ipAddress = '192.168.10.24';
  destinationIp = 'mqtt://broker.zg-cloud.ru:1883';
  macAddress = 'A4:CF:12:8B:3E';
  gatewayId = 'GW-RS485-0001';
  connectionType = 'RS485, мастер шины';
  protocol = 'MQTT 3.1.1';
  status = 'Свободен';
  port = '1883';

  readonly tokens: TokenRow[] = [
    { token: 'mgw_tok_9f2a4c7b3d81e506', provider: 'Yandex IoT Core' },
    { token: 'mgw_tok_7c31e4b8a0d2f945', provider: 'МТС IoT Hub' },
  ];

  cancel(): void {
    this.modalRef.close();
  }

  submit(): void {
    this.modalRef.close();
  }
}
