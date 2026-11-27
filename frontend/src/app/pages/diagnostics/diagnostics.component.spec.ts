import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '../../services/app-config.service';
import { DiagnosticsComponent } from './diagnostics.component';

describe('DiagnosticsComponent', () => {
  it('shows unanswered probes and measurement gaps for enabled path targets', fakeAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiagnosticsComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { probeApiToken: () => 'fixture-token' } }]
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DiagnosticsComponent);
    fixture.detectChanges(); tick();
    http.expectOne('/api/v1/network/devices').flush({ data: { state: 'ready', hosts: [] } });
    http.expectOne('/api/v1/diagnostics/targets').flush({ data: [] });
    http.expectOne('/api/v1/diagnostics/path-targets').flush({ data: [{ id: 'cloudflare', name: 'Cloudflare', address: '1.1.1.1', enabled: true }] });
    tick();
    http.expectOne('/api/v1/diagnostics/path-targets/cloudflare/history').flush({ data: { samples: [
      { time: new Date().toISOString(), address: '1.1.1.1', responded: false, latencyMs: null },
      { time: new Date().toISOString(), address: null, responded: null, latencyMs: null }
    ], events: [] } });
    tick(); fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Cloudflare');
    expect(text).toContain('1 / 1');
    expect(text).toMatch(/No ICMP reply|Keine ICMP-Antwort/);
    fixture.destroy(); http.verify();
  }));

  it('selects a discovered device and displays its recorded measurements', fakeAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiagnosticsComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { probeApiToken: () => 'fixture-token' } }]
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DiagnosticsComponent);
    fixture.detectChanges();
    tick();
    http.expectOne('/api/v1/network/devices').flush({ data: { state: 'ready', hosts: [{ hostname: 'Fixture', macAddress: '02:00:00:00:00:01', addresses: ['192.0.2.1'] }] } });
    http.expectOne('/api/v1/diagnostics/targets').flush({ data: [] });
    http.expectOne('/api/v1/diagnostics/path-targets').flush({ data: [] });
    tick(); fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const buttons = Array.from(element.querySelectorAll('button'));
    buttons[0].click();
    const target = http.expectOne('/api/v1/diagnostics/targets/02%3A00%3A00%3A00%3A00%3A01');
    expect(target.request.method).toBe('PUT');
    expect(target.request.headers.get('Authorization')).toBe('Bearer fixture-token');
    target.flush({ data: [{ mac: '02:00:00:00:00:01', name: 'Fixture' }] });
    tick(); fixture.detectChanges();
    element.querySelector('button')!.click();
    http.expectOne('/api/v1/diagnostics/targets/02%3A00%3A00%3A00%3A00%3A01/history').flush({ data: {
      samples: [{ time: '2026-01-01T12:00:00Z', address: '192.0.2.1', responded: true, latencyMs: 7.5 }], events: []
    } });
    tick(); fixture.detectChanges();
    expect(element.textContent).toContain('7.5 ms');
    fixture.destroy();
    http.verify();
  }));
});
