import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
  LoginOutline,
  UserAddOutline,
  MailOutline,
  ShopOutline,
  ArrowLeftOutline,
} from '@ant-design/icons-angular/icons';
import { routes } from './app.routes';
import { MessageService } from 'primeng/api';

const nzIcons = [LoginOutline, UserAddOutline, MailOutline, ShopOutline, ArrowLeftOutline];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withFetch()),
    provideAnimations(),
    providePrimeNG({
      theme: {
        preset: Aura,
      },
    }),
    provideNzIcons(nzIcons),
    provideServiceWorker('ngsw-worker.js', {
      enabled: true,
      registrationStrategy: 'registerWhenStable:30000',
    }),
    MessageService,
  ],
};
