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
  templateUrl: './dashboard.component.html',
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
