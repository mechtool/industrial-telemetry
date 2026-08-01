import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzIconModule } from 'ng-zorro-antd/icon';

interface RecoveryResponse {
  success: boolean;
  data?: { state?: string };
  error?: { message: string };
}

@Component({
  selector: 'app-kratos-recovery',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzAlertModule,
    NzIconModule,
  ],
  templateUrl: './kratos-recovery.component.html',
  styleUrl: './kratos-recovery.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KratosRecoveryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  email = '';
  error = signal<string | null>(null);
  success = signal(false);
  loading = signal(false);

  flowId = '';

  ngOnInit(): void {
    this.flowId = this.route.snapshot.queryParams['flow'] ?? '';
  }

  async submitRecovery(): Promise<void> {
    if (!this.email) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await fetch('/api/kratos/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email }),
      });

      const data: RecoveryResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Ошибка восстановления');
      }

      this.success.set(true);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка восстановления');
    } finally {
      this.loading.set(false);
    }
  }
}
