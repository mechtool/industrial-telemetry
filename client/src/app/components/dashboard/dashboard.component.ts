import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { MqttClientService } from '../../services/mqtt.service';
import { KratosService } from '../../services/kratos.service';
import { PermissionsService } from '../../services/permissions.service';

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
  imports: [
    CommonModule,
    NzCardModule,
    NzButtonModule,
    NzTagModule,
    NzSkeletonModule,
    RouterLink,
    NzLayoutModule,
    NzMenuModule,
    NzBreadCrumbModule,
    NzIconModule,
    NzGridModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly mqttService = inject(MqttClientService);
  readonly kratosService = inject(KratosService);
  readonly perms = inject(PermissionsService);

  readonly currentYear = new Date().getFullYear();

  mqttConnected = signal<boolean | null>(null);
  subscriptionCount = signal<number | null>(null);

  cards: StatCard[] = [
    { title: 'MQTT статус', value: '...', icon: 'wifi', color: 'var(--color-mqtt-online)', link: '/mqtt' },
    { title: 'Пользователь', value: '...', icon: 'user', color: '#3b82f6', link: '' },
    { title: 'Топики', value: '...', icon: 'apartment', color: '#8b5cf6', link: '/mqtt' },
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

    const user = this.kratosService.currentUser();
    this.cards[1].value = user ? `${user.username} (${user.role})` : '—';
  }
}
