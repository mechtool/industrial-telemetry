import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { UserNewComponent } from '../user-new/user-new.component';

interface UserRow {
  id: string;
  initials: string;
  name: string;
  email: string;
  role: string;
  status: string;
  date: string;
}

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    CommonModule,
    NzButtonModule,
    NzIconModule,
    NzAvatarModule,
    NzInputModule,
    NzSelectModule,
    NzModalModule,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersListComponent {
  private readonly modalService = inject(NzModalService);

  readonly roleOptions = ['Все роли', 'Администратор', 'Менеджер', 'Пользователь'];
  readonly statusOptions = ['Все статусы', 'Активен', 'Заблокирован'];

  readonly users: UserRow[] = [
    { id: '#001', initials: 'ИП', name: 'Иван Петров', email: 'ivan.petrov@cryo.ru', role: 'Администратор', status: 'Активен', date: '01.03.2024' },
    { id: '#002', initials: 'МС', name: 'Мария Смирнова', email: 'm.smirnova@cryo.ru', role: 'Менеджер', status: 'Активен', date: '15.03.2024' },
    { id: '#003', initials: 'КВ', name: 'Кирилл Власов', email: 'k.vlasov@cryo.ru', role: 'Пользователь', status: 'Заблокирован', date: '02.04.2024' },
    { id: '#004', initials: 'АН', name: 'Анна Николаева', email: 'a.nikolaeva@cryo.ru', role: 'Менеджер', status: 'Активен', date: '10.04.2024' },
    { id: '#005', initials: 'ДА', name: 'Дмитрий Агеев', email: 'd.ageev@cryo.ru', role: 'Пользователь', status: 'Активен', date: '22.04.2024' },
    { id: '#006', initials: 'ЕК', name: 'Елена Козлова', email: 'e.kozlova@cryo.ru', role: 'Менеджер', status: 'Заблокирован', date: '03.05.2024' },
    { id: '#007', initials: 'СГ', name: 'Сергей Громов', email: 's.gromov@cryo.ru', role: 'Пользователь', status: 'Активен', date: '14.05.2024' },
    { id: '#008', initials: 'ОМ', name: 'Ольга Морозова', email: 'o.morozova@cryo.ru', role: 'Администратор', status: 'Активен', date: '28.05.2024' },
  ];

  openNewUser(): void {
    this.modalService.create({
      nzTitle: '',
      nzContent: UserNewComponent,
      nzFooter: null,
      nzWidth: 760,
      nzMaskClosable: false,
      nzBodyStyle: { padding: '24px 28px' },
    });
  }
}
