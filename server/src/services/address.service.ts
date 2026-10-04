import { config } from '../config/index.js';
import { fetchWithTimeout } from '../lib/fetch.js';
import type { AppError } from '../middleware/error.middleware.js';

export interface AddressSuggestion {
  /** Полный адрес одной строкой (как его подставляет DaData). */
  value: string;
  /** Полный адрес с почтовым индексом. */
  unrestrictedValue: string;
  postalCode?: string;
  region?: string;
  city?: string;
  street?: string;
  house?: string;
  /** Код ФИАС (ГАР). */
  fiasId?: string;
  /** Код КЛАДР. */
  kladrId?: string;
  /** Широта (WGS84), если DaData вернул координаты. */
  geoLat?: string;
  /** Долгота (WGS84). */
  geoLon?: string;
}

interface DadataSuggestion {
  value: string;
  unrestricted_value: string;
  data: {
    postal_code?: string;
    region?: string;
    city?: string;
    street?: string;
    house?: string;
    fias_id?: string;
    kladr_id?: string;
    geo_lat?: string | null;
    geo_lon?: string | null;
  };
}

interface DadataResponse {
  suggestions?: DadataSuggestion[];
}

class AddressService {
  /**
   * Подсказки адресов РФ через DaData (Suggestions API).
   * Ключ хранится на сервере и не попадает в браузер.
   */
  async suggest(query: string): Promise<AddressSuggestion[]> {
    if (!config.dadata.apiKey) {
      throw this.error('DaData не настроен: задайте DADATA_API_KEY в server/.env', 503);
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(`${config.dadata.apiUrl}/suggest/address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${config.dadata.apiKey}`,
        },
        body: JSON.stringify({ query, count: 10 }),
      });
    } catch {
      throw this.error('Сервис подсказок адресов недоступен', 502);
    }

    if (!response.ok) {
      throw this.error(`Сервис подсказок адресов ответил ${response.status}`, 502);
    }

    const payload = (await response.json()) as DadataResponse;
    return (payload.suggestions ?? []).map((s) => ({
      value: s.value,
      unrestrictedValue: s.unrestricted_value,
      postalCode: s.data.postal_code,
      region: s.data.region,
      city: s.data.city,
      street: s.data.street,
      house: s.data.house,
      fiasId: s.data.fias_id,
      kladrId: s.data.kladr_id,
      geoLat: s.data.geo_lat ?? undefined,
      geoLon: s.data.geo_lon ?? undefined,
    }));
  }

  private error(message: string, statusCode: number): AppError {
    const err = new Error(message) as AppError;
    err.statusCode = statusCode;
    return err;
  }
}

// Синглтон
export const addressService = new AddressService();
