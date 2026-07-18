import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [ButtonModule, RouterLink],
  template: `
    <div class="unauth-container">
      <div class="unauth-card">
        <i class="pi pi-industry text-4xl mb-3" style="color: var(--p-primary-color)" aria-hidden="true"></i>
        <h1 class="text-2xl font-bold mb-2">Industrial Telemetry</h1>
        <p class="text-500 mb-4">Система промышленной телеметрии</p>
        <div class="flex gap-2 justify-content-center">
          <p-button label="Войти" icon="pi pi-sign-in" routerLink="/login" />
          <p-button label="Регистрация" icon="pi pi-user-plus" severity="secondary" routerLink="/registration" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .unauth-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--p-surface-ground, #f8f9fa); }
    .unauth-card { text-align: center; padding: 3rem; max-width: 420px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeComponent {}
