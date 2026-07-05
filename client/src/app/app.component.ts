import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';


interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    ToolbarModule, ButtonModule, AvatarModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly router = inject(Router);

  navItems: NavItem[] = [
    { label: 'Панель', icon: 'pi pi-chart-bar', route: '/dashboard' },
    { label: 'Пользователи', icon: 'pi pi-users', route: '/users' },
    { label: 'MQTT', icon: 'pi pi-wifi', route: '/mqtt' },
  ];
}