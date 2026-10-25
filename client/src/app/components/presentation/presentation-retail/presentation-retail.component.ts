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
  selector: 'app-presentation-retail',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  templateUrl: './presentation-retail.component.html',
  styleUrl: './presentation-retail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresentationRetailComponent {
  readonly capabilities: Capability[] = [
    {
      icon: 'thunderbolt',
      title: 'Температурный мониторинг 24/7',
      desc: 'Непрерывный контроль холодильных витрин, камер и морозильных ларей с точностью до десятых долей градуса.',
    },
    {
      icon: 'bell',
      title: 'Мгновенные алерты',
      desc: 'Уведомления при выходе за пороговые значения — раньше, чем испортится товар и появятся потери.',
    },
    {
      icon: 'bar-chart',
      title: 'Аналитика холодной цепи',
      desc: 'История, тренды и отчёты по каждой точке для контроля качества хранения и обоснования решений.',
    },
    {
      icon: 'file-text',
      title: 'Журналы и протоколы',
      desc: 'Автоматическое формирование журналов для ХАССП, внутренних проверок и отчётности перед сетями.',
    },
    {
      icon: 'safety-certificate',
      title: 'Соответствие нормам',
      desc: 'Готовые выгрузки под требования СанПиН и стандартов торговых сетей — без ручного сбора данных.',
    },
    {
      icon: 'wifi',
      title: 'Подключение без замены оборудования',
      desc: 'Шлюзы по Wi-Fi, Ethernet и MQTT подключают существующие датчики и контроллеры к единой платформе.',
    },
  ];

  readonly techniques: Technique[] = [
    { name: 'MQTT-телеметрия', desc: 'Лёгкий протокол доставки показаний с шлюзов в реальном времени.' },
    { name: 'Временные ряды', desc: 'Хранение и быстрая выборка миллионов измерений для графиков и отчётов.' },
    { name: 'PWA', desc: 'Работа с любого устройства — десктоп, планшет, телефон, включая офлайн-режим.' },
    { name: 'Ory Kratos / Keto', desc: 'Безопасная аутентификация и тонкое разграничение прав доступа.' },
    { name: 'Контейнеризация', desc: 'Развёртывание в Docker и облаке с масштабированием на тысячи точек.' },
  ];

  readonly roadmap: RoadmapItem[] = [
    { title: 'Предиктивное обслуживание', desc: 'Прогноз отказов компрессоров и дефростов по данным датчиков до наступления сбоя.' },
    { title: 'Push-уведомления', desc: 'Мобильные алерты и сводки по сменам прямо на телефон ответственного.' },
    { title: 'Интеграция с 1С и BI', desc: 'Автовыгрузка потерь, KPI и отклонений в учётные и аналитические системы.' },
    { title: 'Энергоменеджмент', desc: 'Оптимизация энергопотребления холодильного парка и контроль пиковых нагрузок.' },
  ];

  readonly benefits: Benefit[] = [
    { value: 'до −60%', label: 'потерь продукции', desc: 'за счёт раннего обнаружения отклонений температуры' },
    { value: '99.9%', label: 'доступность данных', desc: 'мониторинг без пропусков показаний и ручных обходов' },
    { value: '×2', label: 'скорость реакции', desc: 'на инциденты по сравнению с ручными проверками' },
    { value: '24/7', label: 'контроль', desc: 'непрерывное наблюдение за холодной цепью в каждой точке' },
  ];
}
