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
  template: `
    <p-toast />
    <div class="page-container">
      <h1 class="page-title">MQTT Телеметрия</h1>

      <!-- Статус -->
      <div class="card-grid mb-3">
        <p-card>
          <div class="flex align-items-center gap-3">
            <i class="pi pi-wifi text-3xl" [style.color]="connected() ? 'var(--color-mqtt-online)' : 'var(--color-mqtt-offline)'"></i>
            <div>
              <div class="text-sm text-500">MQTT брокер</div>
              <p-tag [value]="connected() ? 'Подключён' : 'Отключён'" [severity]="connected() ? 'success' : 'danger'" />
            </div>
          </div>
        </p-card>
        <p-card>
          <div class="flex align-items-center gap-3">
            <i class="pi pi-sitemap text-3xl" style="color:#8b5cf6"></i>
            <div>
              <div class="text-sm text-500">Активных подписок</div>
              <span class="text-2xl font-bold">{{ subscriptions().length }}</span>
            </div>
          </div>
        </p-card>
      </div>

      <!-- Подписка на топик -->
      <p-card header="Управление подписками" styleClass="mb-3">
        <div class="flex flex-wrap gap-2 align-items-end">
          <div class="flex flex-column gap-1 flex-1" style="min-width:200px">
            <label class="text-sm font-medium">Топик</label>
            <input pInputText [(ngModel)]="newTopic" placeholder="sensors/temperature" />
          </div>
          <p-button label="Подписаться" icon="pi pi-plus" (onClick)="subscribe()" [disabled]="!newTopic() || subscribing()" [loading]="subscribing()" />
          <p-button label="Отписаться" icon="pi pi-minus" severity="danger" (onClick)="unsubscribe()" [disabled]="!newTopic() || subscribing()" />
        </div>
        <p-divider />
        <h3 class="text-base font-semibold mb-2">Активные подписки</h3>
        @if (subscriptions().length > 0) {
          <div class="flex flex-wrap gap-2">
            @for (sub of subscriptions(); track sub) {
              <p-tag [value]="sub" severity="info" styleClass="cursor-pointer" (click)="newTopic.set(sub)" />
            }
          </div>
        } @else {
          <span class="text-500 text-sm">Нет активных подписок</span>
        }
      </p-card>

      <!-- Публикация -->
      <p-card header="Публикация сообщения">
        <div class="flex flex-column gap-3">
          <div class="flex flex-wrap gap-2 align-items-end">
            <div class="flex flex-column gap-1 flex-1" style="min-width:200px">
              <label class="text-sm font-medium">Топик</label>
              <input pInputText [(ngModel)]="publishTopic" placeholder="sensors/alarm" />
            </div>
            <div class="flex flex-column gap-1 flex-1" style="min-width:200px">
              <label class="text-sm font-medium">Сообщение</label>
              <input pInputText [(ngModel)]="publishMessage" placeholder='{"value": 42}' />
            </div>
            <p-button label="Отправить" icon="pi pi-send" (onClick)="publish()" [disabled]="!publishTopic() || !publishMessage() || publishing()" [loading]="publishing()" />
          </div>
        </div>
      </p-card>
    </div>
  `,
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
