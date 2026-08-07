import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
  LoginOutline,
  UserAddOutline,
  UserOutline,
  MailOutline,
  ShopOutline,
  ArrowLeftOutline,
  PieChartOutline,
  DesktopOutline,
  TeamOutline,
  FileOutline,
  WifiOutline,
  ApartmentOutline,
  ReloadOutline,
  PlusOutline,
  MinusOutline,
  SendOutline,
  SaveOutline,
} from '@ant-design/icons-angular/icons';
import { routes } from './app.routes';

const nzIcons = [
  LoginOutline,
  UserAddOutline,
  UserOutline,
  MailOutline,
  ShopOutline,
  ArrowLeftOutline,
  PieChartOutline,
  DesktopOutline,
  TeamOutline,
  FileOutline,
  WifiOutline,
  ApartmentOutline,
  ReloadOutline,
  PlusOutline,
  MinusOutline,
  SendOutline,
  SaveOutline,
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withFetch()),
    provideAnimations(),
    provideNzIcons(nzIcons),
    provideServiceWorker('ngsw-worker.js', {
      enabled: true,
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
