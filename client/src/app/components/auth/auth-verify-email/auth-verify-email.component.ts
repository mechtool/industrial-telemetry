import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-auth-verify-email',
  standalone: true,
  imports: [NzButtonModule, NzIconModule],
  templateUrl: './auth-verify-email.component.html',
  styleUrl: './auth-verify-email.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthVerifyEmailComponent {
  private readonly router = inject(Router);

  goToRegistration(): void {
    this.router.navigate(['/registration']);
  }
}
