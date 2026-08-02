import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
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
    CardModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    RouterLink,
    NzLayoutModule,
    NzMenuModule,
    NzBreadCrumbModule,
    NzIconModule,
    NzAvatarModule,
    NzTooltipModule,
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

  get userName(): string {
    const u = this.kratosService.currentUser();
    return u ? u.username : 'Name';
  }

  get userInitial(): string {
    return this.userName.charAt(0).toUpperCase() || '?';
  }

  cards: StatCard[] = [
    { title: 'MQTT статус', value: '...', icon: 'pi pi-wifi', color: 'var(--color-mqtt-online)', link: '/mqtt' },
    { title: 'Пользователь', value: '...', icon: 'pi pi-user', color: '#3b82f6', link: '' },
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

    const user = this.kratosService.currentUser();
    this.cards[1].value = user ? `${user.username} (${user.role})` : '—';
  }
}
