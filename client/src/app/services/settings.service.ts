import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface AppSettings {
  appName: string;
  language: string;
  theme: string;
  version: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);

  load(): Observable<AppSettings> {
    return this.api.get<AppSettings>('/settings').pipe(map((res) => res.data));
  }

  save(input: Partial<AppSettings>): Observable<AppSettings> {
    return this.api.put<AppSettings>('/settings', input).pipe(map((res) => res.data));
  }
}
