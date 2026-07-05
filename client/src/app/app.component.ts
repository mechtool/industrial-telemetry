import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { SidebarModule } from 'primeng/sidebar';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, NgClass,
    ToolbarModule, ButtonModule, AvatarModule, SidebarModule,
  ],
  template: `
    <div class="layout-wrapper">
      <!-- Sidebar -->
      <aside class="layout-sidebar">
        <div class="sidebar-header">
          <i class="pi pi-industry text-3xl" style="color: var(--p-primary-color)"></i>
          <span class="text-xl font-bold ml-2">Telemetry</span>
        </div>

        <nav class="sidebar-nav">
          @for (item of navItems; track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="active-link"
              [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
              class="nav-item"
            >
              <i [class]="item.icon + ' text-xl'"></i>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <span class="text-xs text-500">Industrial Telemetry v1.0</span>
        </div>
      </aside>

      <!-- Main content -->
      <main class="layout-main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
    }

    .layout-wrapper {
      display: flex;
      height: 100%;
    }

    .layout-sidebar {
      width: var(--sidebar-width);
      min-width: var(--sidebar-width);
      height: 100vh;
      background: var(--p-ground-background);
      border-right: 1px solid var(--p-surface-border);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      left: 0;
      z-index: 10;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      padding: 1.25rem;
      border-bottom: 1px solid var(--p-surface-border);
    }

    .sidebar-nav {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0.75rem;
      gap: 0.25rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.7rem 1rem;
      border-radius: var(--border-radius);
      color: var(--p-text-muted-color);
      text-decoration: none;
      transition: background var(--transition-speed), color var(--transition-speed);
      font-weight: 500;
      font-size: 0.95rem;

      &:hover {
        background: var(--p-surface-hover);
        color: var(--p-text-color);
      }

      &.active-link {
        background: var(--p-primary-color);
        color: var(--p-primary-contrast-color);
      }
    }

    .sidebar-footer {
      padding: 1rem;
      border-top: 1px solid var(--p-surface-border);
      text-align: center;
    }

    .layout-main {
      flex: 1;
      margin-left: var(--sidebar-width);
      min-height: 100vh;
      overflow-y: auto;
      background: var(--p-surface-ground, var(--p-ground-background));
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  navItems: NavItem[] = [
    { label: 'Панель', icon: 'pi pi-chart-bar', route: '/dashboard' },
    { label: 'Пользователи', icon: 'pi pi-users', route: '/users' },
    { label: 'MQTT', icon: 'pi pi-wifi', route: '/mqtt' },
  ];
}
