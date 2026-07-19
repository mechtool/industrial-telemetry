import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

interface RecoveryResponse {
  success: boolean;
  data?: { state?: string };
  error?: { message: string };
}

@Component({
  selector: 'app-kratos-recovery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CardModule, ButtonModule, InputTextModule, MessageModule],
  templateUrl: './kratos-recovery.component.html',
  styleUrl: './kratos-recovery.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KratosRecoveryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
