import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalRef } from 'ng-zorro-antd/modal';

@Component({
  selector: 'app-object-new',
  standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, NzInputModule, NzSelectModule],
  templateUrl: './object-new.component.html',
  styleUrl: './object-new.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectNewComponent {
  private readonly modalRef = inject(NzModalRef);

  readonly typeOptions = ['Насос', 'Холодильная камера', 'Горка', 'Баннет', 'Агрегат', 'Конденсаторный блок'];
  readonly statusOptions = ['Активен', 'Неактивен'];
  readonly projectOptions = ['Холод-Логистик Север'];
  readonly controllerOptions = ['Danfoss AK-CC 550', 'Carel pRack pR300', 'Eliwell IC 915', 'Siemens S7-1200'];
  readonly gatewayOptions = ['GW-01', 'GW-02', 'GW-03'];

  name = '';
  objectId = '';
  type = '';
  status = 'Активен';
  organization = '';
  project = '';
  login = '';
  createdDate = '';
  controller = '';
  gateway = '';

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
