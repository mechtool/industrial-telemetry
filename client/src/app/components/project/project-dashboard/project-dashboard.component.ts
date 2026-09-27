import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

interface Metric {
  label: string;
  trend: string;
  value: string;
  note: string;
  tone: 'default' | 'good' | 'warn' | 'danger';
}

interface DataSource {
  name: string;
  detail: string;
  state: string;
}

interface ObjectRow {
  object: string;
  type: string;
  controller: string;
  reading: string;
  link: string;
  status: string;
}

interface Gateway {
  name: string;
  detail: string;
  state: string;
}

interface Trigger {
  name: string;
  condition: string;
  action: string;
}

@Component({
  selector: 'app-project-dashboard',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule],
  templateUrl: './project-dashboard.component.html',
  styleUrl: './project-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDashboardComponent {
  readonly liveLabel = 'Сводная информация по проекту · обновление каждые 30 секунд LIVE · 08:42';

  readonly metrics: Metric[] = [
    { label: 'ОБЪЕКТОВ ТЕЛЕМЕТРИИ', trend: '+2 за месяц', value: '24', note: '7 типов · камеры, шкафы, лари, горки, насосы', tone: 'default' },
    { label: 'КОНТРОЛЛЕРОВ НА СВЯЗИ', trend: '94%', value: '17/18', note: 'Без связи: ледогенератор LG-3, шлюз GW-02', tone: 'good' },
    { label: 'ОТКЛОНЕНИЯ ТЕМПЕРАТУРЫ', trend: '+1 за сутки', value: '3', note: '21 объект в норме · аварийных нет', tone: 'warn' },
    { label: 'АКТИВНЫЕ ТРИГГЕРЫ', trend: '12 за сутки', value: '5', note: '1 задача с приоритетом «авария»', tone: 'warn' },
  ];

  readonly dataSources: DataSource[] = [
    { name: 'Modbus TCP', detail: '412 регистров', state: 'актуально' },
    { name: 'OPC UA', detail: '128 узлов', state: 'актуально' },
    { name: 'MQTT', detail: '96 топиков', state: 'задержка 2 с' },
    { name: 'Ручной ввод', detail: '14 параметров', state: '12.05, 08:30' },
  ];

  readonly objects: ObjectRow[] = [
    { object: 'Холодильная камера К-1', type: 'Камера', controller: 'Danfoss AK-CC 550', reading: '−18,4 °C', link: 'онлайн', status: 'Норма' },
    { object: 'Ледогенератор LG-2', type: 'Ледогенератор', controller: 'Carel pRack pR300', reading: '+0,4 °C', link: 'онлайн', status: 'Норма' },
    { object: 'Холодильный шкаф ШХ-3', type: 'Шкаф', controller: 'Eliwell IC 915', reading: '+2,1 °C', link: 'онлайн', status: 'Норма' },
    { object: 'Холодильный ларь Л-4', type: 'Ларь', controller: 'Danfoss EKC 202', reading: '−21,7 °C', link: 'онлайн', status: 'Отклонение' },
    { object: 'Банкетная горка БГ-5', type: 'Горка', controller: 'Carel IR33', reading: '+3,9 °C', link: 'онлайн', status: 'Норма' },
    { object: 'Холодильная банкетка БН-6', type: 'Банкетка', controller: 'Eliwell IDPlus 974', reading: '+1,4 °C', link: 'онлайн', status: 'Норма' },
    { object: 'Насос гликолевого контура Н-1', type: 'Насос', controller: 'Siemens S7-1200', reading: '2,4 бар', link: 'онлайн', status: 'Норма' },
    { object: 'Ледогенератор LG-3', type: 'Ледогенератор', controller: 'Carel pRack pR300', reading: '—', link: 'нет связи', status: 'Авария' },
  ];

  readonly gateways: Gateway[] = [
    { name: 'GW-01 · Парнас, шкаф 3', detail: '10.20.4.11 · Modbus TCP · 96 устройств', state: 'онлайн' },
    { name: 'GW-02 · Парнас, шкаф 7', detail: '10.20.4.12 · Modbus TCP · 68 устройств', state: '1 объект без связи' },
    { name: 'GW-03 · резервный канал', detail: '10.44.2.7 · MQTT/LTE · 24 устройства', state: 'резерв' },
  ];

  readonly triggers: Trigger[] = [
    { name: 'Аварийная температура камеры', condition: 'если t выше −16 °C дольше 5 минут', action: 'уведомить диспетчера' },
    { name: 'Потеря связи с контроллером', condition: 'если нет данных более 10 минут', action: 'SMS + заявка в сервис' },
    { name: 'Плановое ТО холодильных шкафов', condition: 'каждые 90 дней по графику', action: 'создать задачу' },
    { name: 'Автоматическая разморозка испарителя', condition: 'если t растёт 3 цикла подряд', action: 'команда контроллеру' },
  ];

  statusColor(status: string): string {
    if (status === 'Норма') return '#0fa97e';
    if (status === 'Отклонение') return '#d98a16';
    if (status === 'Авария') return '#d9574e';
    return '#8fa6bc';
  }
}
