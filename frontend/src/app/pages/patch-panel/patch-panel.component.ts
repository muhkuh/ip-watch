import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';

import { NetworkApiService, PatchPanel, PatchPort } from '../../services/network-api.service';
import { safeGetItem } from '../../utils/storage';

const TEXT = {
  en: {
    title: 'Patch panel', back: 'Network', position: 'Position', reload: 'Reload', export: 'Export JSON', import: 'Import JSON',
    label: 'Label', room: 'Room', outlet: 'Outlet', notes: 'Notes', switchPort: 'Switch port', verified: 'Outlet verified',
    unpatched: 'Unpatched', unassigned: 'Outlet unassigned', unverified: 'Outlet unverified', link: 'Live link unknown',
    save: 'Save', cancel: 'Cancel', edit: 'Edit', loading: 'Loading inventory…', saved: 'Inventory saved.',
    confirm: 'Replace all 12 positions with this file?', invalidFile: 'Choose a valid JSON file under 60 KB.',
    INVENTORY_DISABLED: 'Patch panel inventory is disabled.', INVENTORY_CONFIGURATION_ERROR: 'The server inventory configuration needs attention.',
    INVENTORY_UNAVAILABLE: 'The patch panel inventory is unavailable.', UNAUTHORIZED: 'Check the IP Watch token in probe settings.',
    REVISION_CONFLICT: 'The inventory changed elsewhere. Reload before saving again.', DUPLICATE_SWITCH_PORT: 'This switch port is already assigned.',
    DUPLICATE_OUTLET: 'This room outlet is already assigned.', INVALID_INVENTORY: 'Check the patch panel fields and file format.'
  },
  de: {
    title: 'Patchpanel', back: 'Netzwerk', position: 'Position', reload: 'Neu laden', export: 'JSON exportieren', import: 'JSON importieren',
    label: 'Beschriftung', room: 'Raum', outlet: 'Anschlussdose', notes: 'Notizen', switchPort: 'Switchport', verified: 'Anschluss geprüft',
    unpatched: 'Nicht gepatcht', unassigned: 'Kein Anschluss zugeordnet', unverified: 'Anschluss ungeprüft', link: 'Live-Linkstatus unbekannt',
    save: 'Speichern', cancel: 'Abbrechen', edit: 'Bearbeiten', loading: 'Inventar wird geladen …', saved: 'Inventar gespeichert.',
    confirm: 'Alle zwölf Positionen durch diese Datei ersetzen?', invalidFile: 'Wähle eine gültige JSON-Datei unter 60 KB.',
    INVENTORY_DISABLED: 'Das Patchpanel-Inventar ist deaktiviert.', INVENTORY_CONFIGURATION_ERROR: 'Die Inventarkonfiguration auf dem Server muss geprüft werden.',
    INVENTORY_UNAVAILABLE: 'Das Patchpanel-Inventar ist nicht verfügbar.', UNAUTHORIZED: 'Prüfe den IP-Watch-Token in den Probe-Einstellungen.',
    REVISION_CONFLICT: 'Das Inventar wurde in einem anderen Fenster geändert. Lade es vor dem Speichern neu.',
    DUPLICATE_SWITCH_PORT: 'Dieser Switchport ist bereits zugeordnet.', DUPLICATE_OUTLET: 'Diese Anschlussdose ist bereits zugeordnet.',
    INVALID_INVENTORY: 'Prüfe die Eingaben und das Dateiformat.'
  }
} as const;

@Component({
  selector: 'app-patch-panel',
  imports: [FormsModule, RouterLink],
  templateUrl: './patch-panel.component.html',
  styles: `
    .inventory-button, input:not([type='checkbox']), textarea {
      border: 1px solid var(--card-border);
      border-radius: .375rem;
      min-height: var(--tap-min);
      padding: .375rem .75rem;
    }
    .inventory-button { font-size: .875rem; font-weight: 600; }
    .inventory-button:disabled { opacity: .5; }
    input:not([type='checkbox']), textarea {
      display: block;
      background: var(--app-bg);
      margin-top: .25rem;
      width: 100%;
    }
  `
})
export class PatchPanelComponent implements OnInit {
  private readonly api = inject(NetworkApiService);
  protected readonly text = TEXT[safeGetItem('ip-watch-locale-v1') === 'de' ? 'de' : 'en'];
  protected readonly panel = signal<PatchPanel | null>(null);
  protected readonly draft = signal<PatchPort | null>(null);
  protected readonly busy = signal(false);
  protected readonly feedback = signal('');

  ngOnInit(): void {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    const panel = await this.request(this.api.getPatchPanel());
    if (panel) {
      this.panel.set(panel);
      this.draft.set(null);
    }
  }

  protected edit(port: PatchPort): void {
    this.feedback.set('');
    this.draft.set({ ...port });
  }

  protected async save(port: PatchPort): Promise<void> {
    const panel = this.panel();
    if (!panel) return;
    await this.commit(this.api.savePatchPort(panel.revision, port));
  }

  protected async export(): Promise<void> {
    const data = await this.request(this.api.exportPatchPanel());
    if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ip-watch-patch-panel.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected async import(input: HTMLInputElement): Promise<void> {
    const panel = this.panel();
    const file = input.files?.item(0);
    input.value = '';
    if (!file || !panel || this.busy()) return;
    let document: unknown;
    try {
      if (file.size > 60000) throw new Error('File is too large.');
      document = JSON.parse(await file.text());
    } catch {
      this.feedback.set(this.text.invalidFile);
      return;
    }
    if (window.confirm(this.text.confirm)) await this.commit(this.api.importPatchPanel(panel.revision, document));
  }

  private async commit(operation: Observable<PatchPanel>): Promise<void> {
    const panel = await this.request(operation);
    if (!panel) return;
    this.panel.set(panel);
    this.draft.set(null);
    this.feedback.set(this.text.saved);
  }

  private async request<T>(operation: Observable<T>): Promise<T | undefined> {
    if (this.busy()) return;
    this.busy.set(true);
    this.feedback.set('');
    try {
      return await firstValueFrom(operation);
    } catch (error) {
      const code: unknown = error instanceof HttpErrorResponse ? error.error?.error?.code : undefined;
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.panel.set(null);
        this.draft.set(null);
      }
      const text = this.text;
      this.feedback.set(typeof code === 'string' && Object.hasOwn(text, code) ? text[code as keyof typeof text] : text.INVENTORY_UNAVAILABLE);
      return undefined;
    } finally {
      this.busy.set(false);
    }
  }
}
