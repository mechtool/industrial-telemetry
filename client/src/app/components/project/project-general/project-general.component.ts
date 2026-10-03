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

interface ServiceOrg {
  name: string;
  role: string;
  desc: string;
}

@Component({
  selector: 'app-project-general',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzAvatarModule],
  templateUrl: './project-general.component.html',
  styleUrl: './project-general.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectGeneralComponent {
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

  readonly organizations: ServiceOrg[] = [
    { name: 'ООО «КриоСервис»', role: 'головной подрядчик', desc: 'ТО холодильного оборудования · договор с 12.03.2021' },
    { name: 'ООО «ТехноХолод»', role: 'контроллеры и шкафы', desc: 'Сервис Danfoss, Carel · SLA 8 часов' },
    { name: 'АО «СевЗапЭнерго»', role: 'электропитание', desc: 'ИБП и питание шкафов · регламент 1 раз в квартал' },
    { name: 'ООО «ХладоТех Сервис»', role: 'камеры и лари', desc: 'Плановое ТО камер и ларей · каждые 90 дней' },
  ];
}
