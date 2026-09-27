import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';

interface Requisite {
  label: string;
  value: string;
  highlight?: boolean;
}

@Component({
  selector: 'app-project-view',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzAvatarModule],
  templateUrl: './project-view.component.html',
  styleUrl: './project-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectViewComponent {
  readonly syncedAt = 'синхронизировано 12.05.2024, 08:42';

  readonly requisites: Requisite[] = [
    { label: 'КОД ПРОЕКТА', value: 'PRJ-1042' },
    { label: 'СТАТУС ПРОЕКТА', value: 'В работе' },
    { label: 'ГОРОД', value: 'Санкт-Петербург' },
    { label: 'АДРЕС ОБЪЕКТА', value: '3-й Верхний пер., 12, корп. 4' },
    { label: 'ОТВЕТСТВЕННЫЙ', value: 'А. Ковалёв · +7 921 445-09-12' },
    { label: 'ОБЪЕКТОВ ТЕЛЕМЕТРИИ', value: '24 объекта · 7 типов' },
    { label: 'КОНТРОЛЛЕРОВ', value: '18 · Danfoss, Carel, Eliwell' },
    { label: 'ОНЛАЙН КОНТРОЛЛЕРЫ', value: '17 из 18 — 96%', highlight: true },
  ];

  readonly address = '196140, Санкт-Петербург, 3-й Верхний пер., 12, корп. 4';
  readonly phoneObject = '+7 812 244-17-08 · круглосуточно';

  readonly managerInitials = 'КА';
  readonly managerName = 'Ковалёв Андрей Сергеевич';
  readonly managerRole = 'Инженер по холодильному оборудованию';
  readonly managerPhone = '+7 921 445-09-12 · дежурный 24/7';
  readonly managerEmail = 'a.kovalev@cryomon.ru';
}
