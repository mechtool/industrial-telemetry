import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';

interface Capability {
  icon: string;
  title: string;
  desc: string;
}

interface Technique {
  name: string;
  desc: string;
}

interface RoadmapItem {
  title: string;
  desc: string;
}

interface Benefit {
  value: string;
  label: string;
  desc: string;
}

@Component({
  selector: 'app-presentation-service',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  templateUrl: './presentation-service.component.html',
  styleUrl: './presentation-service.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresentationServiceComponent {
  readonly capabilities: Capability[] = [
    {
      icon: 'cluster',
      title: 'Единый парк оборудования',
      desc: 'Все клиентские объекты в одном окне: статус, телеметрия, аварии и история по каждому агрегату.',
    },
    {
      icon: 'desktop',
      title: 'Удалённая диагностика',
      desc: 'Доступ к рабочим параметрам оборудования без выезда на объект — быстрее находить причину сбоя.',
    },
    {
      icon: 'notification',
      title: 'Диспетчеризация заявок',
      desc: 'Автоматическое создание инцидентов при отклонениях и назначение исполнителей по правилам.',
    },
    {
      icon: 'profile',
      title: 'SLA и отчётность',
      desc: 'Контроль сроков реакции, статистика по объектам и наглядные отчёты для заказчиков и руководства.',
    },
    {
      icon: 'edit',
      title: 'Обслуживание по состоянию',
      desc: 'Профилактика по фактическому состоянию вместо плановых обходов — меньше выездов и простоев.',
    },
    {
      icon: 'swap',
      title: 'Интеграции по API',
      desc: 'Подключение к учётным, биллинговым и диспетчерским системам для сквозных бизнес-процессов.',
    },
  ];

  readonly techniques: Technique[] = [
    { name: 'MQTT-телеметрия', desc: 'Надёжная доставка телеметрии с распределённых объектов в реальном времени.' },
    { name: 'Временные ряды', desc: 'История параметров каждого агрегата для диагностики и анализа трендов.' },
    { name: 'PWA', desc: 'Работа инженеров с планшета и телефона на выезде, включая офлайн-режим.' },
    { name: 'Ory Kratos / Keto', desc: 'Разделение доступа заказчиков, инженеров и администраторов по ролям.' },
    { name: 'Облачное развёртывание', desc: 'Гибкое масштабирование под рост числа обслуживаемых объектов.' },
  ];

  readonly roadmap: RoadmapItem[] = [
    { title: 'Предиктивные алерты', desc: 'Прогноз деградации узлов и предупреждение о будущем отказе до выезда.' },
    { title: 'Мобильное приложение инженера', desc: 'Заявки, маршруты и телеметрия объектов на смартфоне специалиста.' },
    { title: 'Цифровой двойник объекта', desc: 'Модель оборудования для симуляции режимов и планирования обслуживания.' },
    { title: 'Портал самообслуживания заказчика', desc: 'Доступ клиентов к статусу оборудования, заявкам и отчётам.' },
  ];

  readonly benefits: Benefit[] = [
    { value: '−45%', label: 'выездов на объекты', desc: 'за счёт удалённой диагностики и ранних алертов' },
    { value: '×1.8', label: 'решений с первой заявки', desc: 'инженер приезжает уже с готовым диагнозом' },
    { value: 'до −30%', label: 'аварийных простоев', desc: 'благодаря обслуживанию по фактическому состоянию' },
    { value: '100%', label: 'прозрачность SLA', desc: 'все сроки и события фиксируются автоматически' },
  ];
}
