import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface MqttStatus {
  connected: boolean;
  subscriptions: string[];
}

@Injectable({ providedIn: 'root' })
export class MqttClientService {
  private readonly api = inject(ApiService);

  getStatus(): Observable<MqttStatus> {
    return this.api.get<MqttStatus>('/mqtt/status').pipe(map(r => r.data));
  }

  getSubscriptions(): Observable<string[]> {
    return this.api.get<string[]>('/mqtt/subscriptions').pipe(map(r => r.data));
  }

  subscribe(topic: string): Observable<{ topic: string; subscriptions: string[] }> {
    return this.api.post<{ topic: string; subscriptions: string[] }>('/mqtt/subscribe', { topic }).pipe(map(r => r.data));
  }

  unsubscribe(topic: string): Observable<{ topic: string; subscriptions: string[] }> {
    return this.api.post<{ topic: string; subscriptions: string[] }>('/mqtt/unsubscribe', { topic }).pipe(map(r => r.data));
  }

  publish(topic: string, message: string | object): Observable<{ topic: string; message: unknown }> {
    const payload = typeof message === 'object' ? JSON.stringify(message) : message;
    return this.api.post<{ topic: string; message: unknown }>('/mqtt/publish', { topic, message: payload }).pipe(map(r => r.data));
  }
}
