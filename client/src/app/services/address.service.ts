import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface AddressSuggestion {
  value: string;
  unrestrictedValue: string;
  postalCode?: string;
  region?: string;
  city?: string;
  street?: string;
  house?: string;
  fiasId?: string;
  kladrId?: string;
  geoLat?: string;
  geoLon?: string;
}

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly api = inject(ApiService);

  /** Подсказки адресов через серверный прокси (DaData). */
  suggest(query: string): Observable<AddressSuggestion[]> {
    return this.api.get<AddressSuggestion[]>('/address/suggest', { query }).pipe(
      map((res) => res.data),
    );
  }
}
