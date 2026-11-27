import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timeout } from 'rxjs';

import { AppConfigService } from './app-config.service';

export interface DiscoveredHost {
  hostname: string | null;
  addresses: string[];
  macAddress: string | null;
  reportedActive: boolean | null;
}

export interface NetworkSnapshot {
  source: 'fritz-tr064';
  state: 'disabled' | 'configuration_error' | 'pending' | 'ready' | 'partial' | 'stale' | 'unavailable';
  observedAt: string | null;
  router: { name: string | null; model: string | null; softwareVersion: string | null } | null;
  hosts: DiscoveredHost[] | null;
  partial: boolean;
}

export interface PatchPort {
  position: number;
  label: string;
  room: string;
  outlet: string;
  notes: string;
  switchPort: number | null;
  verified: boolean;
}

export interface PatchPanel {
  panelId: 'main';
  revision: number;
  ports: PatchPort[];
}

export interface MeshSnapshot {
  state: string;
  observedAt: string | null;
  errorCode: string | null;
  topology: {
    nodes: { id: string; name: string | null; model: string | null; role: string; meshed: boolean | null }[];
    links: { id: string; from: string; to: string; type: string; state: string; rxSignalDbm: number | null }[];
  } | null;
}

export interface DiagnosticHistory {
  samples: { time: string; address: string | null; responded: boolean | null; latencyMs: number | null }[];
  events: { time: string; id: string; from: string; to: string; type: string; state: string }[];
}

export interface PathTarget { id: string; name: string; address: string | null; enabled: boolean; }

const PANEL_URL = '/api/v1/patch-panels/main';

@Injectable({ providedIn: 'root' })
export class NetworkApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  getDevices(): Observable<NetworkSnapshot> {
    return this.request<NetworkSnapshot>('GET', '/api/v1/network/devices');
  }

  getPatchPanel(): Observable<PatchPanel> {
    return this.request<PatchPanel>('GET', `${PANEL_URL}/ports`);
  }

  getMesh(): Observable<MeshSnapshot> {
    return this.request<MeshSnapshot>('GET', '/api/v1/network/mesh');
  }

  getTargets(): Observable<{ mac: string; name: string }[]> {
    return this.request('GET', '/api/v1/diagnostics/targets');
  }

  setTarget(mac: string, enabled: boolean): Observable<{ mac: string; name: string }[]> {
    return this.request(enabled ? 'PUT' : 'DELETE', `/api/v1/diagnostics/targets/${encodeURIComponent(mac)}`);
  }

  getHistory(mac: string): Observable<DiagnosticHistory> {
    return this.request('GET', `/api/v1/diagnostics/targets/${encodeURIComponent(mac)}/history`);
  }

  getPathTargets(): Observable<PathTarget[]> {
    return this.request('GET', '/api/v1/diagnostics/path-targets');
  }

  setPathTarget(id: string, enabled: boolean): Observable<PathTarget[]> {
    return this.request(enabled ? 'PUT' : 'DELETE', `/api/v1/diagnostics/path-targets/${encodeURIComponent(id)}`);
  }

  getPathHistory(id: string): Observable<DiagnosticHistory> {
    return this.request('GET', `/api/v1/diagnostics/path-targets/${encodeURIComponent(id)}/history`);
  }

  savePatchPort(revision: number, port: PatchPort): Observable<PatchPanel> {
    return this.request<PatchPanel>('PUT', `${PANEL_URL}/ports/${port.position}`, { revision, port });
  }

  exportPatchPanel(): Observable<{ schemaVersion: number; panelId: string; ports: PatchPort[] }> {
    return this.request('GET', `${PANEL_URL}/export`);
  }

  importPatchPanel(revision: number, document: unknown): Observable<PatchPanel> {
    return this.request('PUT', `${PANEL_URL}/import`, { revision, document });
  }

  private request<T>(method: 'GET' | 'PUT' | 'DELETE', url: string, body?: unknown): Observable<T> {
    const token = this.config.probeApiToken().trim();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return this.http.request<{ data: T }>(method, url, { headers, body }).pipe(
      timeout(4000),
      map(({ data }) => data)
    );
  }
}
