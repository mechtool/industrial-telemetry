import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalRef } from 'ng-zorro-antd/modal';

@Component({
  selector: 'app-organization-new',
  standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzSelectModule],
  templateUrl: './organization-new.component.html',
  styleUrl: './organization-new.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationNewComponent {
  private readonly modalRef = inject(NzModalRef);

  readonly typeOptions = ['Сервисная организация', 'Подрядчик', 'Поставщик', 'Энергоснабжающая организация'];
  readonly projectOptions = ['Холод-Логистик Север'];
  readonly contactStatusOptions = ['Основной', 'Дополнительный'];

  name = '';
  objectId = '';
  type = '';
  project = '';
  address = '';
  phone = '';
  mapLink = '';

  contactName = '';
  contactRole = '';
  contactPhone = '';
  contactEmail = '';
  contactStatus = 'Основной';

  cancel(): void {
    this.modalRef.close();
  }

  saveDraft(): void {
    this.modalRef.close();
  }

  submit(): void {
    this.modalRef.close();
  }
}
