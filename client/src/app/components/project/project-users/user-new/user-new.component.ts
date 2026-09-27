import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalRef } from 'ng-zorro-antd/modal';

@Component({
  selector: 'app-user-new',
  standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzSelectModule],
  templateUrl: './user-new.component.html',
  styleUrl: './user-new.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserNewComponent {
  private readonly modalRef = inject(NzModalRef);

  readonly statusOptions = ['Активен', 'Заблокирован'];
  readonly roleOptions = ['Администратор', 'Оператор'];

  name = '';
  organization = '';
  position = '';
  project = '';
  phone = '';
  email = '';
  status = 'Активен';
  createdDate = '';
  login = '';
  password = '';
  rights: string[] = ['Администратор'];

  cancel(): void {
    this.modalRef.close();
  }

  saveDraft(): void {
    this.modalRef.close();
  }

  submit(): void {
    this.modalRef.close();
  }

  toggleRight(right: string, checked: boolean): void {
    if (checked) {
      this.rights = [...this.rights, right];
    } else {
      this.rights = this.rights.filter((r) => r !== right);
    }
  }
}
