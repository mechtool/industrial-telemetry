import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { MqttClientService } from '../../services/mqtt.service';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-mqtt-telemetry',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzTagModule,
    NzDividerModule,
    NzSkeletonModule,
    NzIconModule,
  ],
  templateUrl: './mqtt-telemetry.component.html',
  styleUrl: './mqtt-telemetry.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MqttTelemetryComponent implements OnInit, OnDestroy {
  private readonly mqttService = inject(MqttClientService);
  private readonly message = inject(NzMessageService);

  connected = signal(false);
  subscriptions = signal<string[]>([]);
  newTopic = signal('sensors/#');
  publishTopic = signal('');
  publishMessage = signal('');
  subscribing = signal(false);
  publishing = signal(false);

  private pollSub?: Subscription;

  ngOnInit(): void {
    this.pollSub = interval(5000)
      .pipe(startWith(0), switchMap(() => this.mqttService.getStatus()))
      .subscribe({
        next: (status) => {
          this.connected.set(status.connected);
          this.subscriptions.set(status.subscriptions);
        },
        error: () => {
          this.connected.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  subscribe(): void {
    const topic = this.newTopic().trim();
    if (!topic) return;
    this.subscribing.set(true);
    this.mqttService.subscribe(topic).subscribe({
      next: () => {
        this.message.success(`Подписан на ${topic}`);
        this.subscribing.set(false);
        this.loadStatus();
      },
      error: (err) => {
        this.message.error(err?.error?.error?.message ?? 'Не удалось подписаться');
        this.subscribing.set(false);
      },
    });
  }

  unsubscribe(): void {
    const topic = this.newTopic().trim();
    if (!topic) return;
    this.subscribing.set(true);
    this.mqttService.unsubscribe(topic).subscribe({
      next: () => {
        this.message.info(`Отписан от ${topic}`);
        this.subscribing.set(false);
        this.loadStatus();
      },
      error: (err) => {
        this.message.error(err?.error?.error?.message ?? 'Не удалось отписаться');
        this.subscribing.set(false);
      },
    });
  }

  publish(): void {
    const topic = this.publishTopic().trim();
    const msg = this.publishMessage().trim();
    if (!topic || !msg) return;
    this.publishing.set(true);
    this.mqttService.publish(topic, msg).subscribe({
      next: () => {
        this.message.success(`Опубликовано в ${topic}`);
        this.publishing.set(false);
      },
      error: (err) => {
        this.message.error(err?.error?.error?.message ?? 'Не удалось опубликовать');
        this.publishing.set(false);
      },
    });
  }

  private loadStatus(): void {
    this.mqttService.getStatus().subscribe({
      next: (status) => {
        this.connected.set(status.connected);
        this.subscriptions.set(status.subscriptions);
      },
    });
  }
}
