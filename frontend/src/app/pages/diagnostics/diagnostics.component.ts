import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timer } from 'rxjs';
import { DiagnosticHistory, DiscoveredHost, NetworkApiService } from '../../services/network-api.service';
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
      const [discovery, targets] = await Promise.all([firstValueFrom(this.api.getDevices()), firstValueFrom(this.api.getTargets())]);
      this.hosts.set(discovery.state === 'ready' ? discovery.hosts ?? [] : []);
      this.targets.set(targets);
      if (this.selected()) this.history.set(await firstValueFrom(this.api.getHistory(this.selected())));
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
    this.selected.set(mac);
    this.history.set(null);
    try { this.history.set(await firstValueFrom(this.api.getHistory(mac))); }
    catch { this.error.set(this.de ? 'Verlauf nicht verfügbar.' : 'History unavailable.'); }
  }

  protected time(value: string): string {
    return new Date(value).toLocaleString(this.de ? 'de-DE' : 'en');
  }

  protected hasTarget(mac: string): boolean {
    return this.targets().some((target) => target.mac === mac);
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
