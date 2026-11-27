import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, exhaustMap, finalize, merge, timer } from 'rxjs';

import { MeshSnapshot, NetworkApiService, NetworkSnapshot } from '../../services/network-api.service';
import { safeGetItem } from '../../utils/storage';

const TEXT = {
  de: {
    title: 'Netzwerk', back: 'Geräteüberwachung', patchPanel: 'Patchpanel', refresh: 'Ansicht aktualisieren', loading: 'Netzwerkdaten werden geladen …',
    source: 'Quelle', observed: 'Letzte Beobachtung', hosts: 'Erkannte Geräte', empty: 'Die FRITZ!Box hat keine Geräte gemeldet.',
    unknown: 'Unbekannt', active: 'Aktiv gemeldet', inactive: 'Inaktiv gemeldet', stateUnknown: 'Status unbekannt',
    disabled: 'Die FRITZ!-Integration ist deaktiviert.', configuration_error: 'Die FRITZ!-Integration ist nicht vollständig konfiguriert.',
    pending: 'Erster Abruf ausstehend.', ready: 'Aktuell', partial: 'Unvollständige Daten', stale: 'Veralteter Stand',
    unavailable: 'Die FRITZ!Box-Daten sind derzeit nicht verfügbar.',
    auth: 'Der IP-Watch-Token fehlt oder ist ungültig. Prüfe die Probe-Einstellungen.',
    connection: 'Die Netzwerkansicht konnte keine Daten vom Server abrufen.'
  },
  en: {
    title: 'Network', back: 'Device monitoring', patchPanel: 'Patch panel', refresh: 'Refresh view', loading: 'Loading network data…',
    source: 'Source', observed: 'Last observation', hosts: 'Discovered devices', empty: 'The FRITZ!Box reported no devices.',
    unknown: 'Unknown', active: 'Reported active', inactive: 'Reported inactive', stateUnknown: 'Status unknown',
    disabled: 'FRITZ! integration is disabled.', configuration_error: 'FRITZ! integration configuration is incomplete.',
    pending: 'Waiting for the first refresh.', ready: 'Current', partial: 'Incomplete data', stale: 'Stale snapshot',
    unavailable: 'FRITZ!Box data is currently unavailable.',
    auth: 'The IP Watch token is missing or invalid. Check the probe settings.',
    connection: 'The network view could not retrieve data from the server.'
  }
};

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './network.component.html'
})
export class NetworkComponent implements OnInit {
  private readonly api = inject(NetworkApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequests = new Subject<void>();
  protected readonly locale = safeGetItem('ip-watch-locale-v1') === 'de' ? 'de' : 'en';
  private readonly formatter = new Intl.DateTimeFormat(this.locale, { dateStyle: 'medium', timeStyle: 'medium' });

  protected readonly text = TEXT[this.locale];
  protected readonly snapshot = signal<NetworkSnapshot | null>(null);
  protected readonly mesh = signal<MeshSnapshot | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<'auth' | 'connection' | null>(null);
  protected readonly displayedState = computed(() => {
    const snapshot = this.snapshot();
    return snapshot?.observedAt && this.error() ? 'stale' : snapshot?.state ?? 'pending';
  });

  ngOnInit(): void {
    merge(timer(0, 15000), this.refreshRequests).pipe(
      exhaustMap(() => {
        this.busy.set(true);
        return this.api.getDevices().pipe(
          catchError((error: unknown) => {
            const unauthorized = error instanceof HttpErrorResponse && error.status === 401;
            if (unauthorized) { this.snapshot.set(null); this.mesh.set(null); }
            else this.mesh.update((mesh) => mesh?.topology ? { ...mesh, state: 'stale' } : null);
            this.error.set(unauthorized ? 'auth' : 'connection');
            return EMPTY;
          }),
          finalize(() => this.busy.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((snapshot) => {
      this.snapshot.set(snapshot);
      this.error.set(null);
      this.api.getMesh().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (mesh) => this.mesh.set(mesh),
        error: () => this.mesh.set(null)
      });
    });
  }

  protected refresh(): void {
    this.refreshRequests.next();
  }

  protected formatDate(value: string): string {
    return this.formatter.format(new Date(value));
  }

  protected meshNodeName(id: string): string {
    const node = this.mesh()?.topology?.nodes.find((entry) => entry.id === id);
    return node?.name || node?.model || id;
  }
}
