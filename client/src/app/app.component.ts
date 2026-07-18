import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { KratosService } from './services/kratos.service';

interface NavItem {
  route: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ButtonModule, AvatarModule, TooltipModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  readonly kratosService = inject(KratosService);
  readonly router = inject(Router);

  navItems: NavItem[] = [
    { route: '/dashboard', icon: 'pi pi-th-large', label: 'Панель управления' },
    { route: '/mqtt', icon: 'pi pi-wifi', label: 'MQTT Телеметрия' },
  ];

  ngOnInit(): void {
    this.kratosService.checkSession().subscribe();
  }

  logout(): void { this.kratosService.logout(); }
}
