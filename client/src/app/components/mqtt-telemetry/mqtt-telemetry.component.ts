import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { MqttClientService } from '../../services/mqtt.service';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-mqtt-telemetry',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, ButtonModule, InputTextModule,
    TagModule, DividerModule, ToastModule, SkeletonModule,
  ],
  templateUrl: './mqtt-telemetry.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MqttTelemetryComponent implements OnInit, OnDestroy {
  private readonly mqttService = inject(MqttClientService);
  private readonly messageService = inject(MessageService);

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
        this.messageService.add({ severity: 'success', summary: 'MQTT', detail: `Подписан на ${topic}` });
        this.subscribing.set(false);
        this.loadStatus();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Ошибка', detail: err?.error?.error?.message ?? 'Не удалось подписаться' });
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
        this.messageService.add({ severity: 'info', summary: 'MQTT', detail: `Отписан от ${topic}` });
        this.subscribing.set(false);
        this.loadStatus();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Ошибка', detail: err?.error?.error?.message ?? 'Не удалось отписаться' });
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
        this.messageService.add({ severity: 'success', summary: 'MQTT', detail: `Опубликовано в ${topic}` });
        this.publishing.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Ошибка', detail: err?.error?.error?.message ?? 'Не удалось опубликовать' });
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
