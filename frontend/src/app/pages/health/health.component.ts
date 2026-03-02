import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AppConfigService } from '../../services/app-config.service';
import { safeGetItem } from '../../utils/storage';

type Locale = 'de' | 'en';

const LOCALE_KEY = 'ip-watch-locale-v1';

const TEXTS = {
  en: {
    title: 'Probe health',
    subtitle: 'Quick diagnosis for the probe endpoint.',
    endpoint: 'Health endpoint',
    copy: 'Copy URL',
    copied: 'Copied.',
    loading: 'Loading response...',
    response: 'Response',
    error: 'Unable to load health response.',
    back: 'Back'
  },
  de: {
    title: 'Probe-Health',
    subtitle: 'Schnelldiagnose für den Probe-Endpunkt.',
    endpoint: 'Health-Endpunkt',
    copy: 'URL kopieren',
    copied: 'Kopiert.',
    loading: 'Antwort wird geladen...',
    response: 'Antwort',
    error: 'Health-Antwort konnte nicht geladen werden.',
    back: 'Zurück'
  }
} as const;

@Component({
  selector: 'app-health',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="relative min-h-screen px-4 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header class="mb-6">
        <h1 class="font-heading text-3xl text-text">{{ t('title') }}</h1>
        <p class="mt-1 text-sm text-muted">{{ t('subtitle') }}</p>
      </header>

      <div class="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
        <p class="text-xs uppercase text-muted">{{ t('endpoint') }}</p>
        <p class="mt-2 break-all font-mono text-sm text-text">{{ probeHealthUrl() }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="min-h-[var(--tap-min)] rounded-md border border-[var(--card-border)] px-4 py-2 text-sm font-semibold text-muted"
            (click)="copyUrl()"
          >
            {{ copied() ? t('copied') : t('copy') }}
          </button>
        </div>
      </div>

      <div class="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
        <p class="text-xs uppercase text-muted">{{ t('response') }}</p>
        <p *ngIf="loading()" class="mt-2 text-sm text-muted">{{ t('loading') }}</p>
        <p *ngIf="error()" class="mt-2 text-sm text-danger">{{ error() }}</p>
        <pre
          *ngIf="!loading() && !error()"
          class="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-text"
        >
{{ response() }}
        </pre>
      </div>

      <button
        type="button"
        class="mt-6 min-h-[var(--tap-min)] w-full rounded-md border border-[var(--card-border)] px-4 py-3 font-semibold text-muted"
        (click)="goBack()"
      >
        {{ t('back') }}
      </button>
    </section>
  `
})
export class HealthComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly appConfig = inject(AppConfigService);
  private readonly localeState = signal<Locale>(this.loadLocale());
  private readonly copiedState = signal(false);
  private readonly loadingState = signal(true);
  private readonly errorState = signal('');
  private readonly responseState = signal('');

  readonly probeHealthUrl = computed(() => `${this.appConfig.probeBaseUrl()}/api/health`);
  readonly copied = computed(() => this.copiedState());
  readonly loading = computed(() => this.loadingState());
  readonly error = computed(() => this.errorState());
  readonly response = computed(() => this.responseState());

  t(key: keyof (typeof TEXTS)['en']): string {
    const table = TEXTS[this.localeState()];
    return table[key] ?? TEXTS.en[key] ?? key;
  }

  goBack(): void {
    this.router.navigateByUrl('/', { state: { skipSplash: true } });
  }

  async copyUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.probeHealthUrl());
      this.copiedState.set(true);
      window.setTimeout(() => this.copiedState.set(false), 1500);
    } catch {
      // Ignore clipboard errors silently.
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadHealth();
  }

  private async loadHealth(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set('');
    this.responseState.set('');
    try {
      const response = await fetch(this.probeHealthUrl(), { cache: 'no-store' });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || this.t('error'));
      }
      this.responseState.set(text || '(empty)');
    } catch (error) {
      const message = error instanceof Error ? error.message : this.t('error');
      this.errorState.set(message);
    } finally {
      this.loadingState.set(false);
    }
  }

  private loadLocale(): Locale {
    const raw = safeGetItem(LOCALE_KEY);
    return raw === 'de' ? 'de' : 'en';
  }
}
