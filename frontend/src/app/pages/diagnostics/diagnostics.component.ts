import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timer } from 'rxjs';
import { DiagnosticHistory, DiscoveredHost, NetworkApiService, PathTarget } from '../../services/network-api.service';
import { safeGetItem } from '../../utils/storage';

@Component({
  selector: 'app-diagnostics',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './diagnostics.component.html'
})
export class DiagnosticsComponent implements OnInit {
  private readonly api = inject(NetworkApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly de = safeGetItem('ip-watch-locale-v1') === 'de';
  protected readonly hosts = signal<DiscoveredHost[]>([]);
  protected readonly targets = signal<{ mac: string; name: string }[]>([]);
  protected readonly pathTargets = signal<PathTarget[]>([]);
  protected readonly pathOverview = signal<{ target: PathTarget; history: DiagnosticHistory | null }[]>([]);
  protected readonly pathSelected = signal(false);
  protected readonly selected = signal('');
  protected readonly history = signal<DiagnosticHistory | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  ngOnInit(): void {
    timer(0, 30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { void this.refresh(); });
  }

  protected async refresh(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const [discovery, targets, paths] = await Promise.all([firstValueFrom(this.api.getDevices()), firstValueFrom(this.api.getTargets()), firstValueFrom(this.api.getPathTargets())]);
      this.hosts.set(discovery.state === 'ready' ? discovery.hosts ?? [] : []);
      this.targets.set(targets);
      this.pathTargets.set(paths);
      const overview = await Promise.all(paths.filter((target) => target.enabled).map(async (target) => {
        try { return { target, history: await firstValueFrom(this.api.getPathHistory(target.id)) }; }
        catch { return { target, history: null }; }
      }));
      this.pathOverview.set(overview);
      if (this.selected()) this.history.set(await firstValueFrom(this.pathSelected() ? this.api.getPathHistory(this.selected()) : this.api.getHistory(this.selected())));
      this.error.set('');
    } catch {
      this.error.set(this.de ? 'Diagnosedaten nicht verfügbar. Token und Inventar prüfen.' : 'Diagnostics unavailable. Check token and inventory.');
    } finally { this.busy.set(false); }
  }

  protected async changeTarget(mac: string, enabled: boolean): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      this.targets.set(await firstValueFrom(this.api.setTarget(mac, enabled)));
      if (!enabled && this.selected() === mac) { this.selected.set(''); this.history.set(null); }
      this.error.set('');
    } catch {
      this.error.set(this.de ? 'Gerät konnte nicht geändert werden. Die aktuelle FRITZ!-Liste prüfen.' : 'Unable to change device. Check the current FRITZ! list.');
    } finally { this.busy.set(false); }
  }

  protected async showHistory(mac: string): Promise<void> {
    this.pathSelected.set(false);
    this.selected.set(mac);
    this.history.set(null);
    try { this.history.set(await firstValueFrom(this.api.getHistory(mac))); }
    catch { this.error.set(this.de ? 'Verlauf nicht verfügbar.' : 'History unavailable.'); }
  }

  protected async changePath(id: string, enabled: boolean): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      this.pathTargets.set(await firstValueFrom(this.api.setPathTarget(id, enabled)));
      const target = this.pathTargets().find((item) => item.id === id);
      if (!enabled) this.pathOverview.update((items) => items.filter((item) => item.target.id !== id));
      else if (target) {
        try {
          const history = await firstValueFrom(this.api.getPathHistory(id));
          this.pathOverview.update((items) => [...items.filter((item) => item.target.id !== id), { target, history }]);
        } catch { this.pathOverview.update((items) => [...items.filter((item) => item.target.id !== id), { target, history: null }]); }
      }
      if (!enabled && this.pathSelected() && this.selected() === id) { this.selected.set(''); this.history.set(null); }
      this.error.set('');
    } catch { this.error.set(this.de ? 'Messziel konnte nicht geändert werden.' : 'Unable to change probe target.'); }
    finally { this.busy.set(false); }
  }

  protected async showPathHistory(id: string): Promise<void> {
    this.pathSelected.set(true);
    this.selected.set(id);
    this.history.set(null);
    try { this.history.set(await firstValueFrom(this.api.getPathHistory(id))); }
    catch { this.error.set(this.de ? 'Verlauf nicht verfügbar.' : 'History unavailable.'); }
  }

  protected time(value: string): string {
    return new Date(value).toLocaleString(this.de ? 'de-DE' : 'en');
  }

  protected hasTarget(mac: string): boolean {
    return this.targets().some((target) => target.mac === mac);
  }

  protected pathStatus(history: DiagnosticHistory | null): string {
    const sample = history?.samples[0];
    if (!history) return this.de ? 'Verlauf nicht verfügbar' : 'History unavailable';
    if (!sample) return this.de ? 'Warte auf Messung' : 'Waiting for measurement';
    if (Date.now() - Date.parse(sample.time) > 300000) return this.de ? 'Messwert älter als 5 Minuten' : 'Measurement older than 5 minutes';
    if (sample.responded === null) return this.de ? 'Messung nicht möglich' : 'Measurement unavailable';
    if (!sample.responded) return this.de ? 'Keine ICMP-Antwort' : 'No ICMP reply';
    return sample.latencyMs === null ? (this.de ? 'Antwort ohne Zeitwert' : 'Reply without timing') : `${sample.latencyMs} ms`;
  }

  protected summary(history: DiagnosticHistory): { replies: number; unanswered: number; gaps: number; average: string; variation: string } {
    const samples = history.samples;
    const timings = samples.flatMap((sample) => sample.latencyMs === null ? [] : [sample.latencyMs]);
    const changes: number[] = [];
    for (let index = 1; index < samples.length; index += 1) {
      const first = samples[index - 1];
      const second = samples[index];
      if (first.latencyMs !== null && second.latencyMs !== null && Date.parse(first.time) - Date.parse(second.time) <= 120000) {
        changes.push(Math.abs(first.latencyMs - second.latencyMs));
      }
    }
    const average = (values: number[]) => values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '–';
    return {
      replies: samples.filter((sample) => sample.responded === true).length,
      unanswered: samples.filter((sample) => sample.responded === false).length,
      gaps: samples.filter((sample) => sample.responded === null).length,
      average: average(timings), variation: average(changes)
    };
  }
}
