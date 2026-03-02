import { Injectable, computed, signal } from '@angular/core';

import { isLocalStorageAvailable, safeGetItem, safeSetItem } from '../utils/storage';

const PROBE_HOST_KEY = 'ip-watch-probe-host-v1';
const PROBE_PROTOCOL_KEY = 'ip-watch-probe-protocol-v1';
const PROBE_PORT_KEY = 'ip-watch-probe-port-v1';
const PROBE_API_TOKEN_KEY = 'ip-watch-probe-api-token-v1';
const DEFAULT_PROBE_HOST = '192.168.16.30';
const DEFAULT_PROBE_PROTOCOL: 'http' | 'https' = 'http';
const DEFAULT_PROBE_PORT = '';

export interface ProbeConfigInput {
  host: string;
  protocol: 'http' | 'https';
  port: string;
  apiToken: string;
}

/**
 * Holds user-configurable runtime settings for local probe connectivity.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly probeHostState = signal(this.loadProbeHost());
  private readonly probeProtocolState = signal(this.loadProbeProtocol());
  private readonly probePortState = signal(this.loadProbePort());
  private readonly probeApiTokenState = signal(this.loadProbeApiToken());

  readonly probeHost = computed(() => this.probeHostState());
  readonly probeProtocol = computed(() => this.probeProtocolState());
  readonly probePort = computed(() => this.probePortState());
  readonly probeApiToken = computed(() => this.probeApiTokenState());
  readonly probeBaseUrl = computed(() => this.buildBaseUrl());

  /**
   * Updates probe connectivity settings and persists them in browser storage.
   */
  setProbeConfig(value: ProbeConfigInput): boolean {
    const host = value.host.trim() || DEFAULT_PROBE_HOST;
    const protocol = value.protocol === 'https' ? 'https' : 'http';
    const port = this.normalizePort(value.port);
    const apiToken = value.apiToken.trim();

    this.probeHostState.set(host);
    this.probeProtocolState.set(protocol);
    this.probePortState.set(port);
    this.probeApiTokenState.set(apiToken);

    const hostOk = safeSetItem(PROBE_HOST_KEY, host);
    const protocolOk = safeSetItem(PROBE_PROTOCOL_KEY, protocol);
    const portOk = safeSetItem(PROBE_PORT_KEY, port);
    const tokenOk = safeSetItem(PROBE_API_TOKEN_KEY, apiToken);
    return hostOk && protocolOk && portOk && tokenOk;
  }

  private loadProbeHost(): string {
    const fromStorage = safeGetItem(PROBE_HOST_KEY);
    return fromStorage?.trim() || DEFAULT_PROBE_HOST;
  }

  private loadProbeProtocol(): 'http' | 'https' {
    const fromStorage = safeGetItem(PROBE_PROTOCOL_KEY);
    return fromStorage === 'https' ? 'https' : DEFAULT_PROBE_PROTOCOL;
  }

  private loadProbePort(): string {
    return this.normalizePort(safeGetItem(PROBE_PORT_KEY) ?? DEFAULT_PROBE_PORT);
  }

  private loadProbeApiToken(): string {
    return (safeGetItem(PROBE_API_TOKEN_KEY) ?? '').trim();
  }

  isStorageAvailable(): boolean {
    return isLocalStorageAvailable();
  }

  private normalizePort(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 5);
    if (!digits) {
      return '';
    }
    const parsed = Number(digits);
    return parsed >= 1 && parsed <= 65535 ? String(parsed) : '';
  }

  private buildBaseUrl(): string {
    const host = this.probeHostState();
    const protocol = this.probeProtocolState();
    const port = this.probePortState();
    const portPart = this.resolvePortForHost(host, protocol, port);
    return `${protocol}://${host}${portPart}`;
  }

  private resolvePortForHost(host: string, protocol: string, port: string): string {
    if (port) {
      return `:${port}`;
    }
    if (typeof window === 'undefined') {
      return '';
    }
    const currentHost = window.location.hostname;
    const currentProtocol = window.location.protocol.replace(':', '');
    const currentPort = window.location.port;
    if (host === currentHost && protocol === currentProtocol && currentPort) {
      return `:${currentPort}`;
    }
    return '';
  }
}
