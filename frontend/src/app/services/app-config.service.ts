import { Injectable, computed, signal } from '@angular/core';

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
  setProbeConfig(value: ProbeConfigInput): void {
    const host = value.host.trim() || DEFAULT_PROBE_HOST;
    const protocol = value.protocol === 'https' ? 'https' : 'http';
    const port = this.normalizePort(value.port);
    const apiToken = value.apiToken.trim();

    this.probeHostState.set(host);
    this.probeProtocolState.set(protocol);
    this.probePortState.set(port);
    this.probeApiTokenState.set(apiToken);

    localStorage.setItem(PROBE_HOST_KEY, host);
    localStorage.setItem(PROBE_PROTOCOL_KEY, protocol);
    localStorage.setItem(PROBE_PORT_KEY, port);
    localStorage.setItem(PROBE_API_TOKEN_KEY, apiToken);
  }

  private loadProbeHost(): string {
    const fromStorage = localStorage.getItem(PROBE_HOST_KEY);
    return fromStorage?.trim() || DEFAULT_PROBE_HOST;
  }

  private loadProbeProtocol(): 'http' | 'https' {
    const fromStorage = localStorage.getItem(PROBE_PROTOCOL_KEY);
    return fromStorage === 'https' ? 'https' : DEFAULT_PROBE_PROTOCOL;
  }

  private loadProbePort(): string {
    return this.normalizePort(localStorage.getItem(PROBE_PORT_KEY) ?? DEFAULT_PROBE_PORT);
  }

  private loadProbeApiToken(): string {
    return (localStorage.getItem(PROBE_API_TOKEN_KEY) ?? '').trim();
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
    const portPart = port ? `:${port}` : '';
    return `${protocol}://${host}${portPart}`;
  }
}
