import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

import { ProbeStatus } from '../models/probe';
import { CreateDeviceInput } from '../models/device';
import { AppConfigService } from './app-config.service';

type UnknownRecord = Record<string, unknown>;
const CHECK_STATUS_TIMEOUT_MS = 4000;

/**
 * Handles communication with the Raspberry Pi probe API and normalizes status payloads.
 */
@Injectable({ providedIn: 'root' })
export class ProbeApiService {
  constructor(
    private readonly http: HttpClient,
    private readonly appConfig: AppConfigService
  ) {}

  /**
   * Sends the current device list and returns fresh probe results.
   */
  async checkStatuses(devices: CreateDeviceInput[]): Promise<ProbeStatus[]> {
    const payload = await firstValueFrom(
      this.http
        .post<unknown>(this.endpoint('/status/check-now'), { devices }, this.requestOptions())
        .pipe(timeout(CHECK_STATUS_TIMEOUT_MS))
    );
    return this.normalizeStatusPayload(payload);
  }

  private requestOptions(): { headers?: HttpHeaders } {
    const token = this.appConfig.probeApiToken().trim();
    if (!token) {
      return {};
    }
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`
      })
    };
  }

  private endpoint(path: string): string {
    const baseUrl = this.appConfig.probeBaseUrl().replace(/\/+$/, '');
    return `${baseUrl}/api${path}`;
  }

  private normalizeStatusPayload(payload: unknown): ProbeStatus[] {
    if (Array.isArray(payload)) {
      return payload.map((item) => this.normalizeStatusItem(item)).filter((item): item is ProbeStatus => !!item);
    }

    if (payload && typeof payload === 'object') {
      const record = payload as UnknownRecord;
      const candidate = record['items'] ?? record['statuses'] ?? record['data'];
      if (Array.isArray(candidate)) {
        return candidate
          .map((item) => this.normalizeStatusItem(item))
          .filter((item): item is ProbeStatus => !!item);
      }
    }

    return [];
  }

  private normalizeStatusItem(item: unknown): ProbeStatus | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as UnknownRecord;
    const ip = this.stringValue(record['ip'] ?? record['address']);
    if (!ip) {
      return null;
    }

    const reachableCandidate = record['isReachable'] ?? record['reachable'] ?? record['online'];
    const isReachable = typeof reachableCandidate === 'boolean' ? reachableCandidate : false;
    const statusSource = this.normalizeSource(record['statusSource'] ?? record['source']);
    const pingReachable = this.booleanOrNull(record['pingReachable']);
    const httpReachable = this.booleanOrNull(record['httpReachable']);
    const lastCheckedAt =
      this.stringValue(record['lastCheckedAt'] ?? record['checkedAt'] ?? record['timestamp']) ??
      new Date().toISOString();

    return { ip, isReachable, statusSource, lastCheckedAt, pingReachable, httpReachable };
  }

  private normalizeSource(value: unknown): ProbeStatus['statusSource'] {
    const text = this.stringValue(value)?.toUpperCase();
    if (text === 'PING' || text === 'HTTP' || text === 'PING+HTTP' || text === 'UNKNOWN') {
      return text;
    }
    return 'UNKNOWN';
  }

  private stringValue(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private booleanOrNull(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }
}
