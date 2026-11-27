import { TestBed } from '@angular/core/testing';

import { DeviceStoreService } from './device-store.service';
import { ProbeApiService } from './probe-api.service';
import { NetworkApiService } from './network-api.service';

describe('DeviceStoreService', () => {
  let service: DeviceStoreService;
  let probeApiSpy: jasmine.SpyObj<ProbeApiService>;

  beforeEach(async () => {
    localStorage.clear();

    probeApiSpy = jasmine.createSpyObj<ProbeApiService>('ProbeApiService', [
      'checkStatuses'
    ]);
    probeApiSpy.checkStatuses.and.resolveTo([]);

    TestBed.configureTestingModule({
      providers: [DeviceStoreService, { provide: ProbeApiService, useValue: probeApiSpy }, { provide: NetworkApiService, useValue: {} }]
    });

    service = TestBed.inject(DeviceStoreService);
    await service.initialize();
  });

  it('seeds the configured default devices on first initialize', () => {
    const devices = service.devices();
    expect(devices.map(({ name }) => name)).toEqual(jasmine.arrayContaining(['PS5-Leo', 'PS5-Ben', 'PS5-Frank', 'PC-Ben']));
  });

  it('adds a new valid device and persists it in local state', async () => {
    await service.addDevice({
      name: 'Bedroom TV',
      type: 'TV',
      ip: '192.168.16.40',
      probeProtocol: null,
      probePort: null
    });

    const devices = service.devices();
    expect(devices.some((item) => item.ip === '192.168.16.40')).toBeTrue();
  });

  it('normalizes IPv4 before persisting (removes leading zeros)', async () => {
    await service.addDevice({
      name: 'Router',
      type: 'PC',
      ip: '192.168.016.030',
      probeProtocol: null,
      probePort: null
    });

    const devices = service.devices();
    expect(devices.some((item) => item.ip === '192.168.16.30')).toBeTrue();
  });

  it('rejects duplicate IP addresses', async () => {
    await expectAsync(
      service.addDevice({ name: 'Alpha', type: 'PC', ip: '192.168.16.50', probeProtocol: null, probePort: null })
    ).toBeResolved();
    await expectAsync(
      service.addDevice({ name: 'Beta', type: 'PC', ip: '192.168.16.50', probeProtocol: null, probePort: null })
    ).toBeRejectedWithError(
      'A device with this IP already exists.'
    );
  });

  it('rejects invalid IPv4 input', async () => {
    await expectAsync(
      service.addDevice({ name: 'Invalid', type: 'PC', ip: '999.168.1.1', probeProtocol: null, probePort: null })
    ).toBeRejectedWithError(
      'IP must be a valid IPv4 address.'
    );
  });
});
