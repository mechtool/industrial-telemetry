import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzIconModule } from 'ng-zorro-antd/icon';

interface RecoveryResponse {
  success: boolean;
  data?: KratosFlowData;
  error?: { message: string };
}

interface KratosFlowData {
  id: string;
  state: string;
  ui: {
    action: string;
    method: string;
    nodes: KratosNode[];
    messages?: Array<{ id: number; text: string; type: string }>;
  };
}

interface KratosNode {
  type: string;
  group: string;
  attributes: {
    name: string;
    type: string;
    value: string;
    required?: boolean;
    disabled?: boolean;
    node_type: string;
  };
  messages?: Array<{ id: number; text: string; type: string }>;
  meta?: { label?: { id: number; text: string; type: string } };
}

type Step = 'email' | 'password' | 'done';

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
  private readonly router = inject(Router);

  email = '';
  newPass = '';
  newPassConfirm = '';

  error = signal<string | null>(null);
  loading = signal(false);
  step = signal<Step>('email');

  private flowId = '';
  private flowCsrf = '';
  private flowMethod = '';

  ngOnInit(): void {
    const flow = this.route.snapshot.queryParams['flow'] ?? '';
    const token = this.route.snapshot.queryParams['token'] ?? '';
    if (flow && token) {
      // User clicked recovery link — validate token and go to password step
      this.loadFlowWithToken(flow, token);
    } else if (flow) {
      this.flowId = flow;
    }
  }

  private async loadFlowWithToken(flowId: string, token: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const r = await fetch(`/api/kratos/recovery?flow=${flowId}&token=${token}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const d: RecoveryResponse = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error?.message || 'Invalid recovery link');
      this.handle(d.data!);
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        this.error.set('Превышено время ожидания — сервер не отвечает');
      } else {
        this.error.set(e?.message || 'Неверная или просроченная ссылка');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async submitEmail(): Promise<void> {
    if (!this.email) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await fetch('/api/kratos/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email }),
      });
      const d: RecoveryResponse = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error?.message || 'Recovery error');
      this.handle(d.data!);
    } catch (e: any) {
      this.error.set(e?.message || 'Recovery error');
    } finally {
      this.loading.set(false);
    }
  }

  async submitPass(): Promise<void> {
    if (!this.newPass || this.newPass.length < 8) {
      this.error.set('Password must be at least 8 characters');
      return;
    }
    if (this.newPass !== this.newPassConfirm) {
      this.error.set('Passwords do not match');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await fetch('/api/kratos/recovery/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowId: this.flowId,
          csrfToken: this.flowCsrf,
          password: this.newPass,
          method: this.flowMethod || 'password',
        }),
      });
      const d: RecoveryResponse = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error?.message || 'Password set error');
      this.handle(d.data!);
    } catch (e: any) {
      this.error.set(e?.message || 'Password error');
    } finally {
      this.loading.set(false);
    }
  }

  private handle(flow: KratosFlowData): void {
    this.flowId = flow.id;
    this.flowCsrf = this.extractCsrf(flow);
    this.flowMethod = this.extractMethod(flow);
    if (flow.state === 'sent_email') { this.step.set('done'); this.error.set(null); return; }
    const activeMethod = (flow as any).active as string | undefined;
    const hasPassword = activeMethod === 'password' || flow.ui.nodes.some(n =>
      n.group === 'password' ||
      n.attributes?.name === 'password' ||
      n.attributes?.type === 'password'
    );
    if (hasPassword) { this.step.set('password'); this.error.set(null); return; }
    this.step.set('done');
    setTimeout(() => this.router.navigate(['/login']), 3000);
  }

  private extractCsrf(flow: KratosFlowData): string {
    for (const n of flow.ui.nodes) {
      if (n.attributes?.name === 'csrf_token') return n.attributes.value ?? '';
    }
    return '';
  }

  private extractMethod(flow: KratosFlowData): string {
    for (const n of flow.ui.nodes) {
      if (n.attributes?.name === 'method') return n.attributes.value ?? '';
    }
    return '';
  }
}
