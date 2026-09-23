import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzNotificationService } from 'ng-zorro-antd/notification';

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

@Component({
  selector: 'app-auth-change-password',
  standalone: true,
  imports: [FormsModule, NzInputModule, NzButtonModule, NzIconModule],
  templateUrl: './auth-change-password.component.html',
  styleUrl: './auth-change-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthChangePasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notification = inject(NzNotificationService);

  password = signal('');
  passwordConfirm = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  ready = signal(false);

  private flowId = '';
  private flowCsrf = '';
  private flowMethod = '';

  readonly minLengthOk = computed(() => this.password().length >= 8);
  readonly hasUppercase = computed(() => /[A-ZА-ЯЁ]/.test(this.password()));
  readonly hasDigit = computed(() => /\d/.test(this.password()));
  readonly hasSpecial = computed(() => /[^A-Za-zА-Яа-яЁё0-9\s]/.test(this.password()));
  readonly requirementsMet = computed(
    () => this.minLengthOk() && this.hasUppercase() && this.hasDigit() && this.hasSpecial(),
  );
  readonly passwordsMatch = computed(() => !!this.password() && this.password() === this.passwordConfirm());

  ngOnInit(): void {
    const flow = this.route.snapshot.queryParams['flow'] ?? '';
    const token = this.route.snapshot.queryParams['token'] ?? '';
    if (flow) {
      this.loadFlow(flow, token);
    } else {
      this.router.navigate(['/recovery']);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  goToRecovery(): void {
    this.router.navigate(['/recovery']);
  }

  private async loadFlow(flowId: string, token: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const url = token
        ? `/api/kratos/recovery?flow=${flowId}&token=${token}`
        : `/api/kratos/recovery?flow=${flowId}`;
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const d: RecoveryResponse = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error?.message || 'Недействительная ссылка');
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

  private handle(flow: KratosFlowData): void {
    this.flowId = flow.id;
    this.flowCsrf = this.extractCsrf(flow);
    this.flowMethod = this.extractMethod(flow);
    const activeMethod = (flow as any).active as string | undefined;
    const hasPassword = activeMethod === 'password' || flow.ui.nodes.some(n =>
      n.group === 'password' ||
      n.attributes?.name === 'password' ||
      n.attributes?.type === 'password'
    );
    if (hasPassword) {
      this.ready.set(true);
      return;
    }
    // Флоу уже завершён или недействителен — возвращаемся на вход.
    this.router.navigate(['/login']);
  }

  async submitChangePassword(): Promise<void> {
    if (!this.requirementsMet()) {
      this.notification.error('Ошибка', 'Пароль не соответствует требованиям');
      return;
    }
    if (!this.passwordsMatch()) {
      this.notification.error('Ошибка', 'Пароли не совпадают');
      return;
    }
    this.loading.set(true);
    try {
      const r = await fetch('/api/kratos/recovery/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowId: this.flowId,
          csrfToken: this.flowCsrf,
          password: this.password(),
          method: this.flowMethod || 'password',
        }),
      });
      const d: RecoveryResponse = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error?.message || 'Ошибка сохранения пароля');
      this.notification.success('Готово', 'Пароль успешно изменён');
      this.router.navigate(['/login']);
    } catch (e: any) {
      this.notification.error('Ошибка', e?.message || 'Ошибка сохранения пароля');
    } finally {
      this.loading.set(false);
    }
  }

  private extractCsrf(flow: KratosFlowData): string {
    for (const n of flow.ui.nodes) {
      if (n.attributes?.name === 'csrf_token') return n.attributes.value ?? '';
    }
    return '';
  }

  private extractMethod(flow: KratosFlowData): string {
    for (const n of flow.ui.nodes) {
      if (n.attributes?.name === 'method' && n.group === 'password') {
        return n.attributes.value ?? '';
      }
    }
    for (const n of flow.ui.nodes) {
      if (n.attributes?.name === 'method') return n.attributes.value ?? '';
    }
    return '';
  }
}
