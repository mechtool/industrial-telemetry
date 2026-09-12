import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzMessageService } from 'ng-zorro-antd/message';
import { KratosService } from '../../services/kratos.service';
import { SettingsService } from '../../services/settings.service';

interface Option {
  label: string;
  value: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    NzLayoutModule,
    NzMenuModule,
    NzBreadCrumbModule,
    NzIconModule,
    NzAvatarModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    NzSkeletonModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  private readonly kratos = inject(KratosService);
  private readonly settingsService = inject(SettingsService);
  private readonly message = inject(NzMessageService);

  readonly currentYear = new Date().getFullYear();

  readonly loading = signal(false);
  readonly saving = signal(false);

  appName = '';
  language = 'ru';
  theme = 'ng-zorro';
  version = '';

  readonly languageOptions: Option[] = [
    { label: 'Русский', value: 'ru' },
    { label: 'English', value: 'en' },
  ];

  readonly themeOptions: Option[] = [
    { label: 'NG-ZORRO (светлая)', value: 'ng-zorro' },
    { label: 'Тёмная', value: 'dark' },
  ];

  get avatarInitial(): string {
    const user = this.kratos.currentUser();
    return user ? user.username.charAt(0).toUpperCase() : 'U';
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.settingsService.load().subscribe({
      next: (s) => {
        this.appName = s.appName;
        this.language = s.language;
        this.theme = s.theme;
        this.version = s.version;
        this.loading.set(false);
      },
      error: () => {
        this.message.error('Не удалось загрузить настройки');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    this.saving.set(true);
    this.settingsService.save({
      appName: this.appName,
      language: this.language,
      theme: this.theme,
    }).subscribe({
      next: (s) => {
        this.appName = s.appName;
        this.language = s.language;
        this.theme = s.theme;
        this.version = s.version;
        this.saving.set(false);
        this.message.success('Настройки сохранены');
      },
      error: (err) => {
        this.saving.set(false);
        this.message.error(err?.error?.error?.message ?? 'Не удалось сохранить настройки');
      },
    });
  }
}
