import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { MqttClientService } from '../../services/mqtt.service';
import { UsersService } from '../../services/users.service';
import { RouterLink } from '@angular/router';

interface StatCard {
  title: string;
  value: string;
  icon: string;
  color: string;
  link: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, TagModule, SkeletonModule, RouterLink],
  template: `
    <div class="page-container">
      <h1 class="page-title">Панель управления</h1>

      <div class="card-grid">
        @for (card of cards; track card.title) {
          <p-card [routerLink]="card.link" styleClass="cursor-pointer hover:shadow-3 transition-duration-200">
            <div class="flex align-items-center gap-3">
              <span class="text-3xl" [style.color]="card.color">
                <i [class]="card.icon"></i>
              </span>
              <div>
                <div class="text-sm text-500">{{ card.title }}</div>
                <div class="text-2xl font-bold mt-1">{{ card.value }}</div>
              </div>
            </div>
          </p-card>
        } @empty {
          @for (i of [1,2,3]; track i) {
            <p-card><p-skeleton width="100%" height="80px" /></p-card>
          }
        }
      </div>

      <div class="grid mt-4">
        <div class="col-12 md:col-6">
          <p-card header="Состояние системы">
            <div class="flex flex-column gap-3">
              <div class="flex justify-content-between align-items-center">
                <span>MQTT брокер</span>
                @if (mqttConnected() !== null) {
                  <p-tag
                    [value]="mqttConnected() ? 'Подключён' : 'Отключён'"
                    [severity]="mqttConnected() ? 'success' : 'danger'"
                  />
                } @else {
                  <p-skeleton width="6rem" height="1.5rem" />
                }
              </div>
              <div class="flex justify-content-between align-items-center">
                <span>База данных</span>
                <p-tag value="MongoDB" severity="info" />
              </div>
              <div class="flex justify-content-between align-items-center">
                <span>Подписок MQTT</span>
                @if (subscriptionCount() !== null) {
                  <span class="font-bold">{{ subscriptionCount() }}</span>
                } @else {
                  <p-skeleton width="2rem" height="1.5rem" />
                }
              </div>
            </div>
          </p-card>
        </div>

        <div class="col-12 md:col-6">
          <p-card header="Быстрые действия">
            <div class="flex flex-wrap gap-2">
              <p-button label="Пользователи" icon="pi pi-users" severity="info" routerLink="/users" />
              <p-button label="MQTT" icon="pi pi-wifi" severity="help" routerLink="/mqtt" />
              <p-button label="Обновить" icon="pi pi-refresh" severity="secondary" (onClick)="refresh()" />
            </div>
          </p-card>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly mqttService = inject(MqttClientService);
  private readonly usersService = inject(UsersService);

  mqttConnected = signal<boolean | null>(null);
  subscriptionCount = signal<number | null>(null);

  cards: StatCard[] = [
    { title: 'MQTT статус', value: '...', icon: 'pi pi-wifi', color: 'var(--color-mqtt-online)', link: '/mqtt' },
    { title: 'Пользователи', value: '...', icon: 'pi pi-users', color: '#3b82f6', link: '/users' },
    { title: 'Топики', value: '...', icon: 'pi pi-sitemap', color: '#8b5cf6', link: '/mqtt' },
  ];

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.mqttService.getStatus().subscribe({
      next: (status) => {
        this.mqttConnected.set(status.connected);
        this.subscriptionCount.set(status.subscriptions.length);
        this.cards[0].value = status.connected ? 'Онлайн' : 'Офлайн';
        this.cards[0].color = status.connected ? 'var(--color-mqtt-online)' : 'var(--color-mqtt-offline)';
        this.cards[2].value = String(status.subscriptions.length);
      },
      error: () => {
        this.mqttConnected.set(false);
        this.cards[0].value = 'Недоступен';
      },
    });

    this.usersService.getUsers(1, 1).subscribe({
      next: (res) => {
        this.cards[1].value = String(res.pagination?.total ?? 0);
      },
      error: () => {
        this.cards[1].value = '—';
      },
    });
  }
}
