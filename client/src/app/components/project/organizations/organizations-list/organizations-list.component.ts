import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { OrganizationNewComponent } from '../organization-new/organization-new.component';

interface OrganizationRow {
  name: string;
  id: string;
  type: string;
  address: string;
  phone: string;
}

@Component({
  selector: 'app-organizations-list',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzSelectModule, NzModalModule],
  templateUrl: './organizations-list.component.html',
  styleUrl: './organizations-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationsListComponent {
  private readonly modalService = inject(NzModalService);

  readonly typeOptions = ['Все типы', 'Сервисная организация', 'Подрядчик', 'Поставщик', 'Энергоснабжающая организация'];

  readonly organizations: OrganizationRow[] = [
    { name: 'ООО «КриоСервис»', id: 'ORG-001', type: 'Сервисная организация', address: 'Санкт-Петербург, Лиговский пр., 48', phone: '+7 (812) 305-44-12' },
    { name: 'ООО «ТехноХолод»', id: 'ORG-002', type: 'Сервисная организация', address: 'Санкт-Петербург, ул. Салова, 61', phone: '+7 (812) 640-21-88' },
    { name: 'АО «СевЗапЭнерго»', id: 'ORG-003', type: 'Энергоснабжающая организация', address: 'Санкт-Петербург, пл. Конституции, 3', phone: '+7 (812) 494-30-05' },
    { name: 'ООО «ХладоТех Сервис»', id: 'ORG-004', type: 'Сервисная организация', address: 'Санкт-Петербург, наб. Обводного канала, 118', phone: '+7 (812) 703-18-44' },
    { name: 'ООО «КриоМонтаж»', id: 'ORG-005', type: 'Подрядчик', address: 'Санкт-Петербург, Пулковское ш., 30', phone: '+7 (812) 320-76-90' },
    { name: 'ООО «РефСнаб»', id: 'ORG-006', type: 'Поставщик', address: 'Москва, Дмитровское ш., 100', phone: '+7 (495) 785-33-21' },
  ];

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
