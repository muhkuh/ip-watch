import { Injectable, computed, signal } from '@angular/core';

import { CreateDeviceInput, Device } from '../models/device';
import { ProbeStatus } from '../models/probe';
import { ProbeApiService } from './probe-api.service';

const DB_NAME = 'ip-watch-db';
const DB_VERSION = 1;
const DEVICES_STORE = 'devices';
const SEEDED_FLAG = 'ip-watch-seeded-v1';

/**
 * Manages device list state and local persistence for the initial frontend setup.
 */
@Injectable({ providedIn: 'root' })
export class DeviceStoreService {
  constructor(private readonly probeApi: ProbeApiService) {}

  private readonly devicesState = signal<Device[]>([]);
  private readonly loadingState = signal(true);
  private readonly probeConnectionState = signal<'idle' | 'connected' | 'unavailable'>('idle');
  private db: IDBDatabase | null = null;

  readonly devices = computed(() => this.devicesState());
  readonly loading = computed(() => this.loadingState());
  readonly probeConnection = computed(() => this.probeConnectionState());

  /**
   * Initializes IndexedDB connection and loads seeded/local device data.
   */
  async initialize(): Promise<void> {
    this.db = await this.openDatabase();
    await this.ensureSeedData();
    this.devicesState.set(await this.readAllDevices());
    await this.syncStatusesFromProbe();
    this.loadingState.set(false);
  }

  /**
   * Adds a new user-defined device and persists it to IndexedDB.
   */
  async addDevice(input: CreateDeviceInput): Promise<void> {
    const normalized = this.validateInput(input);

    const item: Device = {
      id: crypto.randomUUID(),
      name: normalized.name,
      type: normalized.type,
      ip: normalized.ip,
      probeProtocol: normalized.probeProtocol,
      probePort: normalized.probePort,
      statusSource: 'UNKNOWN',
      isReachable: false,
      lastCheckedAt: new Date().toISOString(),
      pingReachable: null,
      httpReachable: null
    };

    await this.putDevice(item);
    this.devicesState.update((current) => [item, ...current]);
  }

  /**
   * Updates an existing device and persists it to IndexedDB.
   */
  async updateDevice(deviceId: string, input: CreateDeviceInput): Promise<void> {
    const normalized = this.validateInput(input, deviceId);
    const existing = this.devicesState().find((item) => item.id === deviceId);
    if (!existing) {
      throw new Error('Device not found.');
    }

    const updatedDevice: Device = {
      ...existing,
      name: normalized.name,
      type: normalized.type,
      ip: normalized.ip,
      probeProtocol: normalized.probeProtocol,
      probePort: normalized.probePort
    };

    await this.putDevice(updatedDevice);
    this.devicesState.update((current) => current.map((item) => (item.id === deviceId ? updatedDevice : item)));
  }

  /**
   * Removes a device from local IndexedDB.
   */
  async deleteDevice(deviceId: string): Promise<void> {
    await this.deleteDeviceFromDb(deviceId);
    this.devicesState.update((current) => current.filter((item) => item.id !== deviceId));
  }

  /**
   * Returns a lightweight status summary for dashboard cards.
   */
  getSummary(): { total: number; online: number; offline: number } {
    const items = this.devicesState();
    const online = items.filter((d) => d.isReachable).length;
    return { total: items.length, online, offline: items.length - online };
  }

  /**
   * Pulls latest statuses from the probe API and merges by IP.
   */
  async syncStatusesFromProbe(): Promise<void> {
    try {
      const statusRequest = this.devicesState().map((device) => ({
        name: device.name,
        type: device.type,
        ip: device.ip,
        probeProtocol: device.probeProtocol,
        probePort: device.probePort
      }));
      const statuses = await this.probeApi.checkStatuses(statusRequest);

      const map = new Map<string, ProbeStatus>();
      statuses.forEach((status) => map.set(status.ip, status));
      const checkedAt = new Date().toISOString();

      const updated = this.devicesState().map((device) => {
        const probeStatus = map.get(device.ip);
        if (!probeStatus) {
          return {
            ...device,
            isReachable: false,
            statusSource: 'UNKNOWN' as const,
            lastCheckedAt: checkedAt,
            pingReachable: null,
            httpReachable: null
          };
        }
        return {
          ...device,
          isReachable: probeStatus.isReachable,
          statusSource: probeStatus.statusSource,
          lastCheckedAt: probeStatus.lastCheckedAt,
          pingReachable: probeStatus.pingReachable,
          httpReachable: probeStatus.httpReachable
        };
      });

      this.devicesState.set(updated);
      await Promise.all(updated.map((item) => this.putDevice(item)));
      this.probeConnectionState.set(statuses.length > 0 ? 'connected' : 'unavailable');
    } catch {
      const checkedAt = new Date().toISOString();
      const unknown = this.devicesState().map((device) => ({
        ...device,
        isReachable: false,
        statusSource: 'UNKNOWN' as const,
        lastCheckedAt: checkedAt,
        pingReachable: null,
        httpReachable: null
      }));
      this.devicesState.set(unknown);
      await Promise.all(unknown.map((item) => this.putDevice(item)));
      this.probeConnectionState.set('unavailable');
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DEVICES_STORE)) {
          db.createObjectStore(DEVICES_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
    });
  }

  private async ensureSeedData(): Promise<void> {
    if (localStorage.getItem(SEEDED_FLAG) === '1') {
      return;
    }

    const seed: Device[] = [
      {
        id: crypto.randomUUID(),
        name: 'Living Room PS5',
        type: 'PS5',
        ip: '192.168.0.15',
        probeProtocol: null,
        probePort: null,
        statusSource: 'PING+HTTP',
        isReachable: true,
        lastCheckedAt: new Date().toISOString(),
        pingReachable: true,
        httpReachable: true
      },
      {
        id: crypto.randomUUID(),
        name: 'Office PC',
        type: 'PC',
        ip: '192.168.0.22',
        probeProtocol: null,
        probePort: null,
        statusSource: 'PING',
        isReachable: true,
        lastCheckedAt: new Date().toISOString(),
        pingReachable: true,
        httpReachable: null
      }
    ];

    await Promise.all(seed.map((entry) => this.putDevice(entry)));
    localStorage.setItem(SEEDED_FLAG, '1');
  }

  private readAllDevices(): Promise<Device[]> {
    const db = this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DEVICES_STORE, 'readonly');
      const store = tx.objectStore(DEVICES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = (request.result as Device[]).sort((a, b) => b.lastCheckedAt.localeCompare(a.lastCheckedAt));
        resolve(items);
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed.'));
    });
  }

  private putDevice(device: Device): Promise<void> {
    const db = this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DEVICES_STORE, 'readwrite');
      tx.objectStore(DEVICES_STORE).put(device);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed.'));
    });
  }

  private deleteDeviceFromDb(deviceId: string): Promise<void> {
    const db = this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DEVICES_STORE, 'readwrite');
      tx.objectStore(DEVICES_STORE).delete(deviceId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed.'));
    });
  }

  private getDatabase(): IDBDatabase {
    if (!this.db) {
      throw new Error('Device store has not been initialized.');
    }
    return this.db;
  }

  private isIpv4(value: string): boolean {
    const parts = value.split('.');
    if (parts.length !== 4) {
      return false;
    }

    return parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        return false;
      }
      const num = Number(part);
      return num >= 0 && num <= 255;
    });
  }

  private validateInput(input: CreateDeviceInput, excludeDeviceId?: string): CreateDeviceInput {
    const normalizedName = input.name.trim();
    const normalizedIp = this.normalizeIpv4(this.sanitizeIpv4Input(input.ip));
    const normalizedProbeProtocol = input.probeProtocol;
    const normalizedProbePort = input.probePort;

    if (normalizedName.length < 2 || normalizedName.length > 40) {
      throw new Error('Name must be between 2 and 40 characters.');
    }

    if (!this.isIpv4(normalizedIp)) {
      throw new Error('IP must be a valid IPv4 address.');
    }
    if (normalizedProbeProtocol !== null && normalizedProbeProtocol !== 'http' && normalizedProbeProtocol !== 'https') {
      throw new Error('Probe protocol must be http or https.');
    }
    if (
      normalizedProbePort !== null &&
      (!Number.isInteger(normalizedProbePort) || normalizedProbePort < 1 || normalizedProbePort > 65535)
    ) {
      throw new Error('Probe port must be between 1 and 65535.');
    }

    const duplicate = this.devicesState().find(
      (item) => item.ip === normalizedIp && (!excludeDeviceId || item.id !== excludeDeviceId)
    );
    if (duplicate) {
      throw new Error('A device with this IP already exists.');
    }

    return {
      name: normalizedName,
      type: input.type,
      ip: normalizedIp,
      probeProtocol: normalizedProbeProtocol,
      probePort: normalizedProbePort
    };
  }

  private normalizeIpv4(value: string): string {
    if (!this.isIpv4(value)) {
      return value;
    }
    return value
      .split('.')
      .map((part) => String(Number(part)))
      .join('.');
  }

  private sanitizeIpv4Input(value: string): string {
    return value
      .normalize('NFKC')
      .replace(/[。．｡,]/g, '.')
      .replace(/\s+/g, '.')
      .replace(/[^\d.]/g, '')
      .replace(/\.{2,}/g, '.')
      .replace(/^\./, '')
      .replace(/\.$/, '')
      .trim();
  }
}
