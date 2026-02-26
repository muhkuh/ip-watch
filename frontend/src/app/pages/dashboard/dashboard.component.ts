import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CreateDeviceInput, Device } from '../../models/device';
import { AppConfigService } from '../../services/app-config.service';
import { DeviceStoreService } from '../../services/device-store.service';

type Locale = 'de' | 'en';

const LOCALE_KEY = 'ip-watch-locale-v1';

const TEXTS = {
  en: {
    title: 'IP Watch',
    subtitle: 'PS5, PC and TV reachability overview',
    refresh: 'Refresh',
    refreshing: 'Refreshing...',
    refreshingOverlay: 'Refreshing statuses...',
    openHelp: 'Open help',
    probeApi: 'Probe API:',
    probeConnected: 'Connected',
    probeWaiting: 'Waiting',
    probeUnavailable: 'Unavailable',
    host: 'Host:',
    change: 'Change',
    total: 'Total',
    online: 'Online',
    offline: 'Offline',
    loading: 'Loading local device data...',
    httpProbeLabel: 'HTTP probe:',
    edit: 'Edit',
    delete: 'Delete',
    addDeviceAria: 'Add device',
    editDeviceTitle: 'Edit device',
    addDeviceTitle: 'Add device',
    name: 'Name',
    type: 'Type',
    ipAddress: 'IP address',
    httpProbe: 'HTTP probe',
    probePortOptional: 'Probe port (optional)',
    cancel: 'Cancel',
    update: 'Update',
    save: 'Save',
    settingsTitle: 'Probe host settings',
    settingsDefault: 'Default: 192.168.16.30',
    settingsLocalHost: 'Local host / IP',
    protocol: 'Protocol',
    portOptional: 'Port (optional)',
    apiTokenOptional: 'API token (optional)',
    preview: 'Preview:',
    defaultPort: 'Default port:',
    close: 'Close',
    statusHelpTitle: 'Status help',
    statusHelpSubtitle: 'How to read device status and troubleshoot probe issues.',
    helpPingHttp: 'Host responds to ping and HTTP check.',
    helpPing: 'Host responds to ping, no HTTP success.',
    helpHttp: 'HTTP endpoint responds, ping not confirmed.',
    helpUnknown: 'No valid result from probe service.',
    troubleshooting: 'Troubleshooting',
    helpTip1: 'Check probe host/protocol/port in settings.',
    helpTip2: 'Verify Raspberry Pi probe API is running and reachable in LAN.',
    helpTip3: 'Ensure target IP exists in the same network segment.',
    helpTip4: 'Some devices block ping or HTTP when sleeping.',
    helpTip5: 'For HTTPS, verify the endpoint and port are correct.',
    probeHealthEndpoint: 'Probe health endpoint',
    diagPing: 'Ping',
    diagHttp: 'HTTP',
    statusRefreshDone: 'Status refresh completed.',
    statusRefreshFailed: 'Status refresh failed (probe unavailable).',
    hostReachable: 'Probe host {host} is reachable.',
    hostUnavailable: 'Probe host {host} is unavailable.',
    startupReachable: 'Host {host} reachable on startup.',
    startupUnavailable: 'Host {host} unavailable on startup.',
    deleteConfirm: 'Delete "{name}"?',
    errorInitDb: 'Failed to initialize local database.',
    errorCreateDevice: 'Unable to save device.',
    errorDeleteDevice: 'Unable to delete device.',
    errorProbeSync: 'Probe API sync failed.',
    errorMissingEditId: 'Missing device id for edit.',
    errorHostEmpty: 'Probe host must not be empty.',
    errorHostInvalid: 'Probe host format is invalid.',
    errorPortRange: 'Port must be between 1 and 65535.',
    errorNameRange: 'Name must be between 2 and 40 characters.',
    errorIpInvalid: 'IP must be a valid IPv4 address.',
    errorDuplicateIp: 'A device with this IP already exists.',
    errorProbeProtocol: 'Probe protocol must be http or https.',
    errorProbePort: 'Probe port must be between 1 and 65535.',
    errorDeviceMissing: 'Device not found.'
  },
  de: {
    title: 'IP Watch',
    subtitle: 'PS5-, PC- und TV-Erreichbarkeitsübersicht',
    refresh: 'Aktualisieren',
    refreshing: 'Aktualisiere...',
    refreshingOverlay: 'Status wird aktualisiert...',
    openHelp: 'Hilfe öffnen',
    probeApi: 'Probe API:',
    probeConnected: 'Verbunden',
    probeWaiting: 'Warte',
    probeUnavailable: 'Nicht verfügbar',
    host: 'Host:',
    change: 'Ändern',
    total: 'Gesamt',
    online: 'Online',
    offline: 'Offline',
    loading: 'Lade lokale Gerätedaten...',
    httpProbeLabel: 'HTTP-Probe:',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    addDeviceAria: 'Gerät hinzufügen',
    editDeviceTitle: 'Gerät bearbeiten',
    addDeviceTitle: 'Gerät hinzufügen',
    name: 'Name',
    type: 'Typ',
    ipAddress: 'IP-Adresse',
    httpProbe: 'HTTP-Probe',
    probePortOptional: 'Probe-Port (optional)',
    cancel: 'Abbrechen',
    update: 'Aktualisieren',
    save: 'Speichern',
    settingsTitle: 'Probe-Host Einstellungen',
    settingsDefault: 'Standard: 192.168.16.30',
    settingsLocalHost: 'Lokaler Host / IP',
    protocol: 'Protokoll',
    portOptional: 'Port (optional)',
    apiTokenOptional: 'API-Token (optional)',
    preview: 'Vorschau:',
    defaultPort: 'Standard-Port:',
    close: 'Schließen',
    statusHelpTitle: 'Status-Hilfe',
    statusHelpSubtitle: 'So liest du den Gerätestatus und behebst Probe-Probleme.',
    helpPingHttp: 'Host antwortet auf Ping und HTTP-Check.',
    helpPing: 'Host antwortet auf Ping, aber kein HTTP-Erfolg.',
    helpHttp: 'HTTP-Endpunkt antwortet, Ping ist nicht bestätigt.',
    helpUnknown: 'Kein gültiges Ergebnis vom Probe-Service.',
    troubleshooting: 'Fehlersuche',
    helpTip1: 'Prüfe Probe-Host/Protokoll/Port in den Einstellungen.',
    helpTip2: 'Prüfe, ob die Raspberry Pi Probe API im LAN erreichbar ist.',
    helpTip3: 'Stelle sicher, dass die Ziel-IP im gleichen Netzwerksegment liegt.',
    helpTip4: 'Manche Geräte blockieren Ping oder HTTP im Standby.',
    helpTip5: 'Bei HTTPS Endpunkt und Port prüfen.',
    probeHealthEndpoint: 'Probe-Health-Endpunkt',
    diagPing: 'Ping',
    diagHttp: 'HTTP',
    statusRefreshDone: 'Statusaktualisierung abgeschlossen.',
    statusRefreshFailed: 'Statusaktualisierung fehlgeschlagen (Probe nicht erreichbar).',
    hostReachable: 'Probe-Host {host} ist erreichbar.',
    hostUnavailable: 'Probe-Host {host} ist nicht erreichbar.',
    startupReachable: 'Host {host} beim Start erreichbar.',
    startupUnavailable: 'Host {host} beim Start nicht erreichbar.',
    deleteConfirm: '"{name}" löschen?',
    errorInitDb: 'Lokale Datenbank konnte nicht initialisiert werden.',
    errorCreateDevice: 'Gerät konnte nicht gespeichert werden.',
    errorDeleteDevice: 'Gerät konnte nicht gelöscht werden.',
    errorProbeSync: 'Probe-API-Sync fehlgeschlagen.',
    errorMissingEditId: 'Fehlende Geräte-ID zum Bearbeiten.',
    errorHostEmpty: 'Probe-Host darf nicht leer sein.',
    errorHostInvalid: 'Probe-Host-Format ist ungültig.',
    errorPortRange: 'Port muss zwischen 1 und 65535 liegen.',
    errorNameRange: 'Name muss zwischen 2 und 40 Zeichen lang sein.',
    errorIpInvalid: 'IP muss eine gültige IPv4-Adresse sein.',
    errorDuplicateIp: 'Ein Gerät mit dieser IP existiert bereits.',
    errorProbeProtocol: 'Probe-Protokoll muss http oder https sein.',
    errorProbePort: 'Probe-Port muss zwischen 1 und 65535 liegen.',
    errorDeviceMissing: 'Gerät nicht gefunden.'
  }
} as const;

/**
 * Renders the first dashboard view with splash transition and device list.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnDestroy {
  private readonly appConfig = inject(AppConfigService);
  private readonly store = inject(DeviceStoreService);
  private readonly splashVisibleState = signal(true);
  private readonly createDialogState = signal(false);
  private readonly settingsDialogState = signal(false);
  private readonly helpDialogState = signal(false);
  private readonly submitErrorState = signal('');
  private readonly refreshingState = signal(false);
  private readonly toastMessageState = signal('');
  private readonly toastTypeState = signal<'success' | 'error'>('success');
  private readonly dialogModeState = signal<'create' | 'edit'>('create');
  private readonly editingDeviceIdState = signal<string | null>(null);
  private readonly localeState = signal<Locale>(this.loadLocale());
  private pollHandle: number | null = null;
  private toastTimeoutHandle: number | null = null;

  readonly loading = this.store.loading;
  readonly probeConnection = this.store.probeConnection;
  readonly probeHost = this.appConfig.probeHost;
  readonly probeBaseUrl = this.appConfig.probeBaseUrl;
  readonly probeHealthUrl = computed(() => `${this.probeBaseUrl()}/api/health`);
  readonly createDialogOpen = computed(() => this.createDialogState());
  readonly settingsDialogOpen = computed(() => this.settingsDialogState());
  readonly helpDialogOpen = computed(() => this.helpDialogState());
  readonly submitError = computed(() => this.submitErrorState());
  readonly toastMessage = computed(() => this.toastMessageState());
  readonly toastType = computed(() => this.toastTypeState());
  readonly refreshing = computed(() => this.refreshingState());
  readonly dialogMode = computed(() => this.dialogModeState());
  readonly locale = computed(() => this.localeState());
  readonly deviceTypes: Array<CreateDeviceInput['type']> = ['PS5', 'PC', 'TV'];
  readonly formState = signal<CreateDeviceInput>({
    name: '',
    type: 'PS5',
    ip: '',
    probeProtocol: null,
    probePort: null
  });
  readonly settingsHostState = signal(this.appConfig.probeHost());
  readonly settingsProtocolState = signal(this.appConfig.probeProtocol());
  readonly settingsPortState = signal(this.appConfig.probePort());
  readonly settingsTokenState = signal(this.appConfig.probeApiToken());
  readonly settingsValidationErrorState = signal('');
  readonly settingsPreviewUrl = computed(() => {
    const host = this.settingsHostState().trim() || '192.168.16.30';
    const protocol = this.settingsProtocolState();
    const port = this.settingsPortState().trim();
    const portPart = port ? `:${port}` : '';
    return `${protocol}://${host}${portPart}`;
  });

  readonly splashVisible = computed(() => this.splashVisibleState());
  readonly devices = this.store.devices;
  readonly summary = computed(() => this.store.getSummary());
  readonly statusLegend = [
    { label: 'PING+HTTP', colorClass: 'bg-accent' },
    { label: 'PING', colorClass: 'bg-primary' },
    { label: 'HTTP', colorClass: 'bg-warning' },
    { label: 'UNKNOWN', colorClass: 'bg-danger' }
  ] as const;

  constructor() {
    this.store
      .initialize()
      .then(() => {
        this.showStartupProbeToast();
        this.startProbePolling();
      })
      .catch(() => {
        this.submitErrorState.set(this.t('errorInitDb'));
      });
    setTimeout(() => this.splashVisibleState.set(false), 2000);
  }

  ngOnDestroy(): void {
    if (this.pollHandle !== null) {
      window.clearInterval(this.pollHandle);
    }
    if (this.toastTimeoutHandle !== null) {
      window.clearTimeout(this.toastTimeoutHandle);
    }
  }

  setLocale(locale: Locale): void {
    this.localeState.set(locale);
    localStorage.setItem(LOCALE_KEY, locale);
  }

  t(key: keyof (typeof TEXTS)['en'], params?: Record<string, string>): string {
    const table = TEXTS[this.localeState()];
    let text: string = table[key] ?? TEXTS.en[key] ?? key;
    if (!params) {
      return text;
    }
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), value);
    });
    return text;
  }

  getProbeConnectionLabel(): string {
    if (this.probeConnection() === 'connected') {
      return this.t('probeConnected');
    }
    if (this.probeConnection() === 'idle') {
      return this.t('probeWaiting');
    }
    return this.t('probeUnavailable');
  }

  isPingSuccess(device: Device): boolean {
    if (device.pingReachable === true) {
      return true;
    }
    return device.statusSource === 'PING' || device.statusSource === 'PING+HTTP';
  }

  isHttpSuccess(device: Device): boolean {
    if (device.httpReachable === true) {
      return true;
    }
    return device.statusSource === 'HTTP' || device.statusSource === 'PING+HTTP';
  }

  openCreateDialog(): void {
    this.dialogModeState.set('create');
    this.editingDeviceIdState.set(null);
    this.formState.set({ name: '', type: 'PS5', ip: '', probeProtocol: null, probePort: null });
    this.createDialogState.set(true);
    this.submitErrorState.set('');
  }

  openEditDialog(device: Device): void {
    this.dialogModeState.set('edit');
    this.editingDeviceIdState.set(device.id);
    this.formState.set({
      name: device.name,
      type: device.type,
      ip: device.ip,
      probeProtocol: device.probeProtocol,
      probePort: device.probePort
    });
    this.createDialogState.set(true);
    this.submitErrorState.set('');
  }

  closeCreateDialog(): void {
    this.createDialogState.set(false);
    this.submitErrorState.set('');
  }

  openSettingsDialog(): void {
    this.settingsHostState.set(this.appConfig.probeHost());
    this.settingsProtocolState.set(this.appConfig.probeProtocol());
    this.settingsPortState.set(this.appConfig.probePort());
    this.settingsTokenState.set(this.appConfig.probeApiToken());
    this.settingsValidationErrorState.set('');
    this.settingsDialogState.set(true);
  }

  closeSettingsDialog(): void {
    this.settingsDialogState.set(false);
    this.settingsValidationErrorState.set('');
  }

  openHelpDialog(): void {
    this.helpDialogState.set(true);
  }

  closeHelpDialog(): void {
    this.helpDialogState.set(false);
  }

  onSettingsHostChange(value: string): void {
    this.settingsHostState.set(value);
  }

  onSettingsProtocolChange(value: 'http' | 'https'): void {
    this.settingsProtocolState.set(value);
  }

  onSettingsPortChange(value: string): void {
    this.settingsPortState.set(value.replace(/\D/g, '').slice(0, 5));
  }

  onSettingsTokenChange(value: string): void {
    this.settingsTokenState.set(value);
  }

  async saveSettings(): Promise<void> {
    const validationError = this.validateProbeSettings();
    if (validationError) {
      this.settingsValidationErrorState.set(validationError);
      this.showToast(validationError, 'error');
      return;
    }

    this.appConfig.setProbeConfig({
      host: this.settingsHostState(),
      protocol: this.settingsProtocolState(),
      port: this.settingsPortState(),
      apiToken: this.settingsTokenState()
    });
    this.closeSettingsDialog();
    await this.store.syncStatusesFromProbe();
    const savedBaseUrl = this.probeBaseUrl();

    if (this.probeConnection() === 'connected') {
      this.showToast(this.t('hostReachable', { host: savedBaseUrl }), 'success');
      return;
    }
    this.showToast(this.t('hostUnavailable', { host: savedBaseUrl }), 'error');
  }

  async refreshStatuses(): Promise<void> {
    this.refreshingState.set(true);
    await this.store.syncStatusesFromProbe();
    this.refreshingState.set(false);

    if (this.probeConnection() === 'connected') {
      this.showToast(this.t('statusRefreshDone'), 'success');
      return;
    }
    this.showToast(this.t('statusRefreshFailed'), 'error');
  }

  setType(type: CreateDeviceInput['type']): void {
    this.submitErrorState.set('');
    this.formState.update((current) => ({ ...current, type }));
  }

  onNameChange(value: string): void {
    this.submitErrorState.set('');
    this.formState.update((current) => ({ ...current, name: value }));
  }

  onIpInput(value: string): void {
    this.submitErrorState.set('');
    const sanitized = value
      .normalize('NFKC')
      .replace(/[。．｡,]/g, '.')
      .replace(/\s+/g, '.')
      .replace(/[^\d.]/g, '')
      .replace(/\.{2,}/g, '.')
      .replace(/^\./, '')
      .slice(0, 15);
    this.formState.update((current) => ({ ...current, ip: sanitized }));
  }

  onProbeProtocolChange(value: '' | 'http' | 'https'): void {
    this.submitErrorState.set('');
    this.formState.update((current) => ({
      ...current,
      probeProtocol: value === '' ? null : value
    }));
  }

  onProbePortInput(value: string): void {
    this.submitErrorState.set('');
    const digits = value.replace(/\D/g, '').slice(0, 5);
    this.formState.update((current) => ({
      ...current,
      probePort: digits ? Number(digits) : null
    }));
  }

  async submitCreateDevice(): Promise<void> {
    try {
      if (this.dialogModeState() === 'edit') {
        const editingId = this.editingDeviceIdState();
        if (!editingId) {
          throw new Error('Missing device id for edit.');
        }
        await this.store.updateDevice(editingId, this.formState());
      } else {
        await this.store.addDevice(this.formState());
      }
      this.formState.set({ name: '', type: 'PS5', ip: '', probeProtocol: null, probePort: null });
      this.closeCreateDialog();
      try {
        await this.store.syncStatusesFromProbe();
      } catch {
        this.showToast(this.t('statusRefreshFailed'), 'error');
      }
    } catch (error) {
      const message = error instanceof Error ? this.localizeError(error.message) : this.t('errorCreateDevice');
      this.submitErrorState.set(message);
    }
  }

  async deleteDevice(device: Device): Promise<void> {
    const confirmed = window.confirm(this.t('deleteConfirm', { name: device.name }));
    if (!confirmed) {
      return;
    }

    try {
      await this.store.deleteDevice(device.id);
    } catch (error) {
      const message = error instanceof Error ? this.localizeError(error.message) : this.t('errorDeleteDevice');
      this.submitErrorState.set(message);
    }
  }

  private startProbePolling(): void {
    this.pollHandle = window.setInterval(() => {
      this.store.syncStatusesFromProbe().catch(() => {
        this.submitErrorState.set(this.t('errorProbeSync'));
      });
    }, 15000);
  }

  private showStartupProbeToast(): void {
    const host = this.probeBaseUrl();
    if (this.probeConnection() === 'connected') {
      this.showToast(this.t('startupReachable', { host }), 'success');
      return;
    }
    this.showToast(this.t('startupUnavailable', { host }), 'error');
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessageState.set(message);
    this.toastTypeState.set(type);

    if (this.toastTimeoutHandle !== null) {
      window.clearTimeout(this.toastTimeoutHandle);
    }

    this.toastTimeoutHandle = window.setTimeout(() => {
      this.toastMessageState.set('');
    }, 2800);
  }

  private validateProbeSettings(): string | null {
    const host = this.settingsHostState().trim();
    const portValue = this.settingsPortState().trim();

    if (!host) {
      return this.t('errorHostEmpty');
    }

    const hostPattern = /^(localhost|[a-zA-Z0-9.-]+|\d{1,3}(\.\d{1,3}){3})$/;
    if (!hostPattern.test(host)) {
      return this.t('errorHostInvalid');
    }

    if (!portValue) {
      return null;
    }

    const port = Number(portValue);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return this.t('errorPortRange');
    }

    return null;
  }

  private loadLocale(): Locale {
    const raw = localStorage.getItem(LOCALE_KEY);
    return raw === 'de' ? 'de' : 'en';
  }

  private localizeError(message: string): string {
    const map: Record<string, keyof (typeof TEXTS)['en']> = {
      'Name must be between 2 and 40 characters.': 'errorNameRange',
      'IP must be a valid IPv4 address.': 'errorIpInvalid',
      'A device with this IP already exists.': 'errorDuplicateIp',
      'Probe protocol must be http or https.': 'errorProbeProtocol',
      'Probe port must be between 1 and 65535.': 'errorProbePort',
      'Device not found.': 'errorDeviceMissing',
      'Missing device id for edit.': 'errorMissingEditId'
    };
    return this.t(map[message] ?? 'errorCreateDevice');
  }
}
