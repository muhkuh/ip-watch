import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppConfigService } from '../../services/app-config.service';
import { PatchPanel } from '../../services/network-api.service';
import { PatchPanelComponent } from './patch-panel.component';

const PORTS_URL = '/api/v1/patch-panels/main/ports';
const PANEL: PatchPanel = {
  panelId: 'main', revision: 0,
  ports: Array.from({ length: 12 }, (_, index) => ({
    position: index + 1, label: '', room: '', outlet: '', notes: '', switchPort: null, verified: false
  }))
};

describe('PatchPanelComponent', () => {
  let fixture: ComponentFixture<PatchPanelComponent>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PatchPanelComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { probeApiToken: () => 'fixture-panel-token' } }]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatchPanelComponent);
  });

  afterEach(() => http.verify());

  it('shows twelve positions, edits one through the versioned API, and renders the saved result', fakeAsync(() => {
    fixture.detectChanges();
    const load = http.expectOne(PORTS_URL);
    expect(load.request.headers.get('Authorization')).toBe('Bearer fixture-panel-token');
    load.flush({ data: PANEL });
    tick();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const cards = element.querySelectorAll('li');
    expect(cards.length).toBe(12);
    cards[11].querySelector('button')?.click();
    fixture.detectChanges();
    tick();
    const label = element.querySelector<HTMLInputElement>('input[name="label"]')!;
    label.value = 'Fixture outlet';
    label.dispatchEvent(new Event('input'));
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    const save = http.expectOne(`${PORTS_URL}/12`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body.revision).toBe(0);
    expect(save.request.body.port.label).toBe('Fixture outlet');
    save.flush({ data: { ...PANEL, revision: 1, ports: PANEL.ports.map((port) => port.position === 12 ? { ...port, label: 'Fixture outlet' } : port) } });
    tick();
    fixture.detectChanges();
    expect(element.querySelector('form')).toBeNull();
    expect(cards[11].textContent).toContain('Fixture outlet');
  }));
});
