import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalRef } from 'ng-zorro-antd/modal';

@Component({
  selector: 'app-project-new',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
  ],
  templateUrl: './project-new.component.html',
  styleUrl: './project-new.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectNewComponent {
  private readonly modalRef = inject(NzModalRef);

  readonly statusOptions = ['Новый', 'В работе', 'Приостановлен', 'Архив'];
  readonly workModeOptions = ['Круглосуточно', 'пн–пт', 'по расписанию'];

  code = '';
  status = 'Новый';
  name = '';
  city = '';
  address = '';
  phone = '';
  workMode = '';
  manager = '';
  role = '';

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
