import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppConfigService } from '../../services/app-config.service';
import { NetworkSnapshot } from '../../services/network-api.service';
import { NetworkComponent } from './network.component';

const DEVICE_URL = '/api/v1/network/devices';
const SNAPSHOT: NetworkSnapshot = {
  source: 'fritz-tr064', state: 'ready', observedAt: '2026-01-01T12:00:00.000Z', partial: false,
  router: { name: 'Fixture router', model: null, softwareVersion: null },
  hosts: [{ hostname: 'Fixture device', addresses: ['2001:db8::10'], macAddress: null, reportedActive: true }]
};

describe('NetworkComponent', () => {
  let fixture: ComponentFixture<NetworkComponent>;
  let http: HttpTestingController;
  let token: string;
  let originalLocale: string | null;

  beforeEach(() => {
    originalLocale = localStorage.getItem('ip-watch-locale-v1');
    localStorage.setItem('ip-watch-locale-v1', 'en');
    token = 'fixture-ip-watch-token';
    TestBed.configureTestingModule({
      imports: [NetworkComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { probeApiToken: () => token } }]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NetworkComponent);
  });

  afterEach(() => {
    http.verify();
    if (originalLocale === null) localStorage.removeItem('ip-watch-locale-v1');
    else localStorage.setItem('ip-watch-locale-v1', originalLocale);
  });

  it('uses the same-origin endpoint and marks retained observations stale after interruption', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const request = http.expectOne(DEVICE_URL);
    expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-ip-watch-token');
    request.flush({ data: SNAPSHOT });
    http.expectOne('/api/v1/network/mesh').flush({ data: { state: 'ready', observedAt: null, errorCode: null, topology: null } });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Fixture device');
    expect(element.textContent).toContain('Reported active');
    expect(element.querySelector('time')?.dateTime).toBe(SNAPSHOT.observedAt!);
    tick(15000);
    http.expectOne(DEVICE_URL).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(element.textContent).toContain('Stale snapshot');
    expect(element.textContent).toContain('Fixture device');
    fixture.destroy();
  }));

  it('removes a displayed host after loss of authorization', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    http.expectOne(DEVICE_URL).flush({ data: SNAPSHOT });
    http.expectOne('/api/v1/network/mesh').flush({ data: { state: 'ready', observedAt: null, errorCode: null, topology: null } });
    fixture.detectChanges();
    token = '';
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    const request = http.expectOne(DEVICE_URL);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush(null, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('The IP Watch token is missing or invalid.');
    expect(fixture.nativeElement.textContent).not.toContain('Fixture device');
    fixture.destroy();
  }));
});
