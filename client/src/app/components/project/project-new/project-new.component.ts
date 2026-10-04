import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { NzAutocompleteModule } from 'ng-zorro-antd/auto-complete';
import type { NzAutocompleteOptionComponent } from 'ng-zorro-antd/auto-complete';
import { Subject, Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, catchError } from 'rxjs/operators';
import { AddressService, AddressSuggestion } from '../../../services/address.service';
import { ProjectsService, CreateProjectInput } from '../../../services/projects.service';

@Component({
  selector: 'app-project-new',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzAutocompleteModule,
  ],
  templateUrl: './project-new.component.html',
  styleUrl: './project-new.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectNewComponent implements OnInit {
  private readonly modalRef = inject(NzModalRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly addressService = inject(AddressService);
  private readonly projectsService = inject(ProjectsService);
  private readonly addressInput$ = new Subject<string>();

  readonly statusOptions = ['Черновик', 'Новый', 'В работе', 'Приостановлен', 'Архив'];
  readonly workModeOptions = ['Круглосуточно', 'пн–пт', 'по расписанию'];
  readonly monitoringTypeOptions = ['Мобильный', 'Статический', 'Динамический'];

  code = '';
  status = '';
  name = '';
  monitoringType = '';
  address = '';
  phone = '';
  workMode = '';
  manager = '';
  role = '';

  /** Идёт сохранение (блокирует кнопки во время запроса). */
  saving = false;

  /** Последние полученные подсказки (для разбора выбранного пункта). */
  addressSuggestions: AddressSuggestion[] = [];

  /** Выбранный структурированный адрес (с кодами ФИАС/КЛАДР). */
  selectedAddress: AddressSuggestion | null = null;

  /** Поток подсказок адресов: debounce + запрос к серверу (DaData). */
  readonly addressSuggestions$: Observable<AddressSuggestion[]> = this.addressInput$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    tap((raw) => this.updateMapUrl(this.selectedAddress, raw)),
    switchMap((raw): Observable<AddressSuggestion[]> => {
      const query = raw.trim();
      if (query.length < 2) {
        this.addressSuggestions = [];
        return of([]);
      }
      return this.addressService.suggest(query).pipe(
        tap((list) => { this.addressSuggestions = list; }),
        catchError(() => of([])),
      );
    }),
  );

  /** Все обязательные поля заполнены (пробелы не считаются значением). */
  get isFormValid(): boolean {
    return this.name.trim() !== ''
      && this.code.trim() !== ''
      && this.monitoringType.trim() !== '';
  }

  /** URL карты проезда (пересчитывается только при изменении адреса). */
  mapUrl: SafeResourceUrl | null = null;

  private mapUrlString = '';

  /**
   * Пересчитывает URL карты и мемоизирует его по строке: iframe перезагружается
   * только когда адрес реально изменился, а не на каждый цикл change detection.
   */
  private updateMapUrl(selected: AddressSuggestion | null, text: string): void {
    const query = selected?.value || text.trim();
    if (!query) {
      this.mapUrlString = '';
      this.mapUrl = null;
      return;
    }

    const params = ['z=16'];
    if (selected?.geoLon && selected?.geoLat) {
      params.push(`ll=${selected.geoLon},${selected.geoLat}`);
    }
    params.push(`text=${encodeURIComponent(query)}`);
    const url = `https://yandex.ru/map-widget/v1/?${params.join('&')}`;

    if (url === this.mapUrlString) {
      return;
    }
    this.mapUrlString = url;
    this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  ngOnInit(): void {
    // Идентификатор формируется автоматически при открытии формы,
    // чтобы не требовать ручного ввода и гарантировать уникальность.
    this.code = this.generateProjectCode();
  }

  /**
   * Генерирует уникальный идентификатор проекта — 16 десятичных цифр без букв.
   *
   * Случайные байты берутся из crypto.getRandomValues (CSPRNG) и приводятся
   * к цифрам 0–9, что даёт 10^16 возможных значений и практически исключает
   * коллизии.
   */
  private generateProjectCode(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => (byte % 10).toString()).join('');
  }

  cancel(): void {
    this.modalRef.close();
  }

  saveDraft(): void {
    this.status = 'Черновик';
    this.save();
  }

  submit(): void {
    this.status = 'Новый';
    this.save();
  }

  private save(): void {
    this.saving = true;
    this.projectsService.create(this.buildInput()).subscribe({
      next: () => this.modalRef.close(true),
      error: () => { this.saving = false; },
    });
  }

  private buildInput(): CreateProjectInput {
    return {
      code: this.code,
      name: this.name,
      status: this.status,
      monitoringType: this.monitoringType,
      address: this.address,
      phone: this.phone,
      workMode: this.workMode,
      manager: this.manager,
      role: this.role,
    };
  }

  onAddressInput(event: Event): void {
    // Ручной ввод сбрасывает ранее выбранный адрес — карта следует за текстом.
    this.selectedAddress = null;
    this.addressInput$.next((event.target as HTMLInputElement).value);
  }

  onAddressSelect(option: NzAutocompleteOptionComponent): void {
    this.selectedAddress =
      this.addressSuggestions.find((s) => s.value === option.nzValue) ?? null;
    this.updateMapUrl(this.selectedAddress, this.address);
  }
}
