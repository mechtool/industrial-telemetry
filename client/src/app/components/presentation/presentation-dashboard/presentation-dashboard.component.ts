import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';

type MetricStatus = 'normal' | 'warning' | 'critical';
type AlarmSeverity = 'warning' | 'critical';

interface Metric {
  id: string;
  label: string;
  category: string;
  icon: string;
  value: number;
  unit: string;
  decimals: number;
  min: number;
  max: number;
  status: MetricStatus;
}

interface Alarm {
  id: string;
  severity: AlarmSeverity;
  title: string;
  object: string;
  message: string;
  time: string;
}

const SERIES_LENGTH = 48;
const CHART_W = 600;
const CHART_H = 200;
const CHART_PAD = 12;

const TEMP_MIN = -24;
const TEMP_MAX = -18;
const HUM_MIN = 84;
const HUM_MAX = 96;

const initialMetrics: Metric[] = [
  {
    id: 'chamber-temp',
    label: 'Температура камеры',
    category: 'Температура',
    icon: 'fire',
    value: -21.4,
    unit: '°C',
    decimals: 1,
    min: TEMP_MIN,
    max: TEMP_MAX,
    status: 'normal',
  },
  {
    id: 'humidity',
    label: 'Влажность',
    category: 'Влажность',
    icon: 'cloud',
    value: 91.2,
    unit: '%',
    decimals: 1,
    min: HUM_MIN,
    max: HUM_MAX,
    status: 'warning',
  },
  {
    id: 'compressor',
    label: 'Компрессор',
    category: 'Энергопотребление',
    icon: 'tool',
    value: 2.4,
    unit: 'кВт',
    decimals: 1,
    min: 1.8,
    max: 3.2,
    status: 'normal',
  },
  {
    id: 'cond-pressure',
    label: 'Давление конденсации',
    category: 'Давление',
    icon: 'line-chart',
    value: 11.6,
    unit: 'бар',
    decimals: 1,
    min: 9.5,
    max: 13.5,
    status: 'normal',
  },
  {
    id: 'evap-s3',
    label: 'Испаритель S3',
    category: 'Температура',
    icon: 'fire',
    value: -28.9,
    unit: '°C',
    decimals: 1,
    min: -32,
    max: -26,
    status: 'normal',
  },
  {
    id: 'door-opens',
    label: 'Открытия двери',
    category: 'События',
    icon: 'unordered-list',
    value: 3,
    unit: 'раз/смена',
    decimals: 0,
    min: 0,
    max: 12,
    status: 'normal',
  },
  {
    id: 'energy',
    label: 'Энергопотребление',
    category: 'Энергопотребление',
    icon: 'thunderbolt',
    value: 18.7,
    unit: 'кВт·ч',
    decimals: 1,
    min: 12,
    max: 26,
    status: 'normal',
  },
  {
    id: 'defrost',
    label: 'Дефрост (с последнего)',
    category: 'Сервис',
    icon: 'reload',
    value: 42,
    unit: 'мин',
    decimals: 0,
    min: 0,
    max: 90,
    status: 'normal',
  },
];

function seedSeries(min: number, max: number): number[] {
  const points: number[] = [];
  let value = (min + max) / 2;
  for (let i = 0; i < SERIES_LENGTH; i++) {
    value = Math.min(max, Math.max(min, value + (Math.random() - 0.5) * (max - min) * 0.06));
    points.push(value);
  }
  return points;
}

@Component({
  selector: 'app-presentation-dashboard',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  templateUrl: './presentation-dashboard.component.html',
  styleUrl: './presentation-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresentationDashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private dataTimer?: ReturnType<typeof setInterval>;

  readonly now = signal(new Date());

  readonly metrics = signal<Metric[]>(initialMetrics.map((m) => ({ ...m })));

  readonly alarms: Alarm[] = [
    {
      id: 'a1',
      severity: 'critical',
      title: 'Температура выше порога',
      object: 'Камера №12 · заморозка',
      message: '−14.2 °C при допустимом диапазоне −24…−18 °C',
      time: '14:41',
    },
    {
      id: 'a2',
      severity: 'critical',
      title: 'Ошибка датчика S5',
      object: 'Витрина №3 · молочная',
      message: 'Датчик не отвечает, показания недостоверны',
      time: '14:38',
    },
    {
      id: 'a3',
      severity: 'warning',
      title: 'Дверь открыта дольше 5 минут',
      object: 'Камера №7 · рыба',
      message: 'Дверь открыта 6 мин 40 с',
      time: '14:30',
    },
    {
      id: 'a4',
      severity: 'warning',
      title: 'Плановый цикл дефроста',
      object: 'Камера №12 · заморозка',
      message: 'Запущен по расписанию, окончание через 12 мин',
      time: '14:15',
    },
    {
      id: 'a5',
      severity: 'warning',
      title: 'Повышенная влажность',
      object: 'Камера №12 · заморозка',
      message: '94.8 % при норме до 95 %',
      time: '14:05',
    },
  ];

  readonly tempSeries = signal<number[]>(seedSeries(TEMP_MIN, TEMP_MAX));
  readonly humSeries = signal<number[]>(seedSeries(HUM_MIN, HUM_MAX));

  readonly tempLine = computed(() => this.buildLine(this.tempSeries(), TEMP_MIN, TEMP_MAX));
  readonly tempArea = computed(() => this.buildArea(this.tempSeries(), TEMP_MIN, TEMP_MAX));
  readonly humLine = computed(() => this.buildLine(this.humSeries(), HUM_MIN, HUM_MAX));
  readonly humArea = computed(() => this.buildArea(this.humSeries(), HUM_MIN, HUM_MAX));

  readonly tempCurrent = computed(() => this.lastOf(this.tempSeries()));
  readonly humCurrent = computed(() => this.lastOf(this.humSeries()));

  readonly timeText = computed(() =>
    this.now().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  );

  get criticalCount(): number {
    return this.alarms.filter((a) => a.severity === 'critical').length;
  }

  get warningCount(): number {
    return this.alarms.filter((a) => a.severity === 'warning').length;
  }

  ngOnInit(): void {
    this.dataTimer = setInterval(() => this.tick(), 2000);
    this.destroyRef.onDestroy(() => {
      if (this.dataTimer) {
        clearInterval(this.dataTimer);
      }
    });
  }

  formatValue(metric: Metric): string {
    return metric.value.toFixed(metric.decimals);
  }

  statusLabel(status: MetricStatus): string {
    switch (status) {
      case 'critical':
        return 'Критично';
      case 'warning':
        return 'Внимание';
      default:
        return 'Норма';
    }
  }

  private tick(): void {
    this.now.set(new Date());
    this.metrics.update((list) =>
      list.map((m) => ({ ...m, value: this.jitter(m.value, m.min, m.max) })),
    );
    this.tempSeries.update((s) =>
      this.pushSeries(s, this.jitter(this.lastOf(s), TEMP_MIN, TEMP_MAX)),
    );
    this.humSeries.update((s) =>
      this.pushSeries(s, this.jitter(this.lastOf(s), HUM_MIN, HUM_MAX)),
    );
  }

  private pushSeries(series: number[], value: number): number[] {
    const next = [...series, value];
    return next.length > SERIES_LENGTH ? next.slice(next.length - SERIES_LENGTH) : next;
  }

  private lastOf(series: number[]): number {
    return series.length ? series[series.length - 1] : 0;
  }

  private jitter(value: number, min: number, max: number): number {
    const next = value + (Math.random() - 0.5) * (max - min) * 0.05;
    return Math.min(max, Math.max(min, next));
  }

  private buildLine(series: number[], min: number, max: number): string {
    const range = max - min || 1;
    const n = series.length - 1 || 1;
    return series
      .map((value, i) => {
        const x = CHART_PAD + (i / n) * (CHART_W - CHART_PAD * 2);
        const y = CHART_H - CHART_PAD - ((value - min) / range) * (CHART_H - CHART_PAD * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  private buildArea(series: number[], min: number, max: number): string {
    const baseline = CHART_H - CHART_PAD;
    const right = CHART_W - CHART_PAD;
    return `${this.buildLine(series, min, max)} ${right},${baseline} ${CHART_PAD},${baseline}`;
  }
}
