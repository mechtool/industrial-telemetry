import { Component, inject, ChangeDetectionStrategy, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../services/auth.service';
import { PresentationService, PresentationPerspective } from '../../services/presentation.service';

interface PerspectiveTab {
  key: PresentationPerspective;
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-presentation',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
  ],
  templateUrl: './presentation.component.html',
  styleUrl: './presentation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresentationComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  readonly presentation = inject(PresentationService);

  readonly tabs: PerspectiveTab[] = [
    { key: 'retail', label: 'Торговый ритейл', icon: 'shop', route: '/presentation/retail' },
    { key: 'service', label: 'Сервисные организации', icon: 'cluster', route: '/presentation/service' },
  ];

  readonly currentYear = new Date().getFullYear();

  readonly perspectiveLabel = computed(() =>
    this.presentation.perspective() === 'service' ? 'Сервисные организации' : 'Торговый ритейл',
  );

  logout(): void {
    this.auth.logout();
  }

  ngOnInit(): void {
    // Точка зрения определяется почтой демо-пользователя
    // (service@telemetry.ru → service, retail@telemetry.ru → retail).
    this.presentation.syncFromEmail(this.auth.currentUser()?.email);

    // Вход без конкретной точки зрения (/presentation) перенаправляем на нужную.
    if (!this.activatedRoute.firstChild) {
      const perspective = this.presentation.perspective();
      this.router.navigate([`/presentation/${perspective}`], { replaceUrl: true });
    }
  }
}
