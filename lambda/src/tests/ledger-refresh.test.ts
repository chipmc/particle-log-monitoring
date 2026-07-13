import { clearDeviceProductIdCacheForTests, refreshDeviceStatusLedger } from '../ledger-refresh';
import { resolveParticleDeviceProductId } from '../integrations/particle-api';
import { ParticleLedgerClient, ParticleLedgerNames } from '../integrations/particle-ledger';
import { updateDeviceStatusLedgerSnapshot } from '../storage/current-state';
import { DeviceCurrentState, ParticleWebhook } from '../types';

jest.mock('../integrations/particle-api');
jest.mock('../storage/current-state');

const mockResolveProductId = resolveParticleDeviceProductId as jest.MockedFunction<typeof resolveParticleDeviceProductId>;
const mockUpdateSnapshot = updateDeviceStatusLedgerSnapshot as jest.MockedFunction<typeof updateDeviceStatusLedgerSnapshot>;
const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

const originalEnv = process.env;
const body: ParticleWebhook = {
  event: 'occupancy',
  coreid: 'device123',
  product_id: 12345,
};

function createPrevious(ledgerUpdatedAt?: string): DeviceCurrentState {
  return {
    projectId: 'generalized-core-counter',
    deviceId: 'device123',
    lastEventTime: '2026-07-13T10:00:00.000Z',
    lastIngestTime: '2026-07-13T10:00:05.000Z',
    lastEventType: 'telemetry.event',
    healthStatus: 'unknown',
    anomalyCount: 0,
    offlineCandidate: false,
    ...(ledgerUpdatedAt && { deviceStatusLedgerUpdatedAt: ledgerUpdatedAt }),
    updatedAt: '2026-07-13T10:00:05.000Z',
  };
}

function createClient(result: Awaited<ReturnType<ParticleLedgerClient['getDeviceStatus']>>): ParticleLedgerClient {
  return {
    getDeviceStatus: jest.fn().mockResolvedValue(result),
  } as unknown as ParticleLedgerClient;
}

function successResult(updatedAt: string) {
  return {
    ok: true as const,
    ledgerName: ParticleLedgerNames.deviceStatus,
    productId: '12345',
    scopeValue: 'device123',
    data: { connection: { state: 'connected' } },
    instance: {
      name: ParticleLedgerNames.deviceStatus,
      scope: { type: 'Device', value: 'device123' },
      size_bytes: 256,
      data: { connection: { state: 'connected' } },
      updated_at: updatedAt,
    },
  };
}

function failureResult(kind: 'missing_ledger' | 'retryable_failure' | 'network_failure', httpStatus?: number) {
  return {
    ok: false as const,
    ledgerName: ParticleLedgerNames.deviceStatus,
    productId: '12345',
    scopeValue: 'device123',
    error: {
      kind,
      message: 'failed',
      retryable: kind !== 'missing_ledger',
      ...(httpStatus !== undefined && { httpStatus }),
    },
  };
}

async function refresh(overrides: Partial<Parameters<typeof refreshDeviceStatusLedger>[0]> = {}) {
  return refreshDeviceStatusLedger({
    tableName: 'current-state-table',
    projectId: 'generalized-core-counter',
    deviceId: 'device123',
    body,
    previous: null,
    fetchedAt: new Date('2026-07-13T10:10:00.000Z'),
    ...overrides,
  });
}

describe('device-status Ledger projection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      PARTICLE_LEDGER_REFRESH_ENABLED: 'true',
      PARTICLE_LEDGER_REFRESH_DEVICE_IDS: 'device123',
    };
    clearDeviceProductIdCacheForTests();
    mockUpdateSnapshot.mockResolvedValue('updated');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(() => {
    infoSpy.mockRestore();
  });

  it('should skip when the feature is disabled', async () => {
    process.env.PARTICLE_LEDGER_REFRESH_ENABLED = 'false';
    const client = createClient(successResult('2026-07-13T10:05:00.000Z'));

    await expect(refresh({ ledgerClient: client })).resolves.toBe('disabled');

    expect(client.getDeviceStatus).not.toHaveBeenCalled();
    expect(mockUpdateSnapshot).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      'Ledger refresh',
      JSON.stringify({
        deviceId: 'device123',
        ledgerName: ParticleLedgerNames.deviceStatus,
        result: 'skipped',
        reason: 'feature_disabled',
      })
    );
  });

  it('should skip when the device is not allow-listed', async () => {
    process.env.PARTICLE_LEDGER_REFRESH_DEVICE_IDS = 'other-device';
    const client = createClient(successResult('2026-07-13T10:05:00.000Z'));

    await expect(refresh({ ledgerClient: client })).resolves.toBe('not_allow_listed');

    expect(client.getDeviceStatus).not.toHaveBeenCalled();
    expect(mockUpdateSnapshot).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      'Ledger refresh',
      JSON.stringify({
        deviceId: 'device123',
        ledgerName: ParticleLedgerNames.deviceStatus,
        result: 'skipped',
        reason: 'device_not_allowlisted',
      })
    );
  });

  it('should persist a newer Ledger snapshot', async () => {
    const client = createClient(successResult('2026-07-13T10:05:00.000Z'));

    await expect(refresh({ previous: createPrevious('2026-07-13T10:00:00.000Z'), ledgerClient: client })).resolves.toBe('updated');

    expect(client.getDeviceStatus).toHaveBeenCalledWith('12345', 'device123');
    expect(mockUpdateSnapshot).toHaveBeenCalledWith(
      'current-state-table',
      'generalized-core-counter',
      'device123',
      {
        updatedAt: '2026-07-13T10:05:00.000Z',
        fetchedAt: '2026-07-13T10:10:00.000Z',
        sizeBytes: 256,
        data: { connection: { state: 'connected' } },
      }
    );
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      'Ledger refresh',
      JSON.stringify({
        deviceId: 'device123',
        productId: '12345',
        ledgerName: ParticleLedgerNames.deviceStatus,
        ledgerUpdatedAt: '2026-07-13T10:05:00.000Z',
        result: 'updated',
      })
    );
  });

  it('should no-op when the Ledger timestamp is equal', async () => {
    const client = createClient(successResult('2026-07-13T10:05:00.000Z'));

    await expect(refresh({ previous: createPrevious('2026-07-13T10:05:00.000Z'), ledgerClient: client })).resolves.toBe('stale');

    expect(mockUpdateSnapshot).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      'Ledger refresh',
      JSON.stringify({
        deviceId: 'device123',
        productId: '12345',
        ledgerName: ParticleLedgerNames.deviceStatus,
        ledgerUpdatedAt: '2026-07-13T10:05:00.000Z',
        result: 'unchanged',
      })
    );
  });

  it('should no-op when the Ledger timestamp is older', async () => {
    const client = createClient(successResult('2026-07-13T10:04:59.000Z'));

    await expect(refresh({ previous: createPrevious('2026-07-13T10:05:00.000Z'), ledgerClient: client })).resolves.toBe('stale');

    expect(mockUpdateSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    ['HTTP 404', failureResult('missing_ledger', 404)],
    ['HTTP 429', failureResult('retryable_failure', 429)],
    ['HTTP 5xx', failureResult('retryable_failure', 503)],
    ['timeout', failureResult('network_failure')],
  ])('should preserve ingestion on %s', async (_label, result) => {
    const client = createClient(result);

    await expect(refresh({ ledgerClient: client })).resolves.toBe('not_found_or_failed');

    expect(mockUpdateSnapshot).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(infoSpy.mock.calls[0][1] as string);
    expect(logged).toMatchObject({
      deviceId: 'device123',
      productId: '12345',
      ledgerName: ParticleLedgerNames.deviceStatus,
      result: 'failed',
    });
  });

  it('should resolve product id from Particle when the webhook does not include one', async () => {
    mockResolveProductId.mockResolvedValue({
      productId: '67890',
      productIdResolvedAt: '2026-07-13T10:10:00.000Z',
      productIdSource: 'particle-api',
    });
    const client = createClient({ ...successResult('2026-07-13T10:05:00.000Z'), productId: '67890' });

    await expect(refresh({ body: { event: 'occupancy', coreid: 'device123' }, ledgerClient: client })).resolves.toBe('updated');

    expect(mockResolveProductId).toHaveBeenCalledWith('device123', new Date('2026-07-13T10:10:00.000Z'));
    expect(client.getDeviceStatus).toHaveBeenCalledWith('67890', 'device123');
  });

  it('should cache resolved product id for later webhook refreshes in the same warm container', async () => {
    mockResolveProductId.mockResolvedValue({
      productId: '67890',
      productIdResolvedAt: '2026-07-13T10:10:00.000Z',
      productIdSource: 'particle-api',
    });
    const client = createClient({ ...successResult('2026-07-13T10:05:00.000Z'), productId: '67890' });
    const bodyWithoutProductId = { event: 'occupancy', coreid: 'device123' };

    await refresh({ body: bodyWithoutProductId, ledgerClient: client });
    await refresh({ body: bodyWithoutProductId, ledgerClient: client });

    expect(mockResolveProductId).toHaveBeenCalledTimes(1);
    expect(client.getDeviceStatus).toHaveBeenCalledTimes(2);
    expect(client.getDeviceStatus).toHaveBeenNthCalledWith(1, '67890', 'device123');
    expect(client.getDeviceStatus).toHaveBeenNthCalledWith(2, '67890', 'device123');
  });
});