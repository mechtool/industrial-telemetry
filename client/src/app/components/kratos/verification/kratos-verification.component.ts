import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

interface VerificationResponse {
  success: boolean;
  error?: { message: string };
}

@Component({
  selector: 'app-kratos-verification',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CardModule, ButtonModule, InputTextModule, MessageModule],
  templateUrl: './kratos-verification.component.html',
  styleUrl: './kratos-verification.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KratosVerificationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  email = '';
  error = signal<string | null>(null);
  success = signal(false);
  loading = signal(false);

  flowId = '';

  ngOnInit(): void {
    this.flowId = this.route.snapshot.queryParams['flow'] ?? '';
  }

  async submitVerification(): Promise<void> {
    if (!this.email) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await fetch('/api/kratos/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email }),
      });

      const data: VerificationResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Ошибка верификации');
      }

      this.success.set(true);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка верификации');
    } finally {
      this.loading.set(false);
    }
  }
}
