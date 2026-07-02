import { resolveParticleDeviceName } from '../integrations/particle-api';

const originalEnv = process.env;
const fetchMock = jest.fn();

describe('Particle API device identity lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      PARTICLE_ACCESS_TOKEN: 'particle-token',
      PARTICLE_API_BASE_URL: 'https://particle.example.test',
    };
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: fetchMock,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: undefined,
    });
  });

  it('should resolve a device name successfully', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'e00fce6841443bcc0f3178e4',
        name: 'gateway-raleigh-01',
      }),
    });

    const result = await resolveParticleDeviceName(
      'e00fce6841443bcc0f3178e4',
      new Date('2026-07-01T10:00:00.000Z')
    );

    expect(result).toEqual({
      deviceName: 'gateway-raleigh-01',
      deviceNameResolvedAt: '2026-07-01T10:00:00.000Z',
      deviceNameSource: 'particle-api',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://particle.example.test/v1/devices/e00fce6841443bcc0f3178e4',
      expect.objectContaining({
        headers: { Authorization: 'Bearer particle-token' },
      })
    );
  });

  it('should return null when the response is missing a name', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'device123' }),
    });

    await expect(resolveParticleDeviceName('device123')).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'Phase3C Particle device-name lookup failed',
      expect.stringContaining('device123'),
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  it('should return null for API 404', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: jest.fn(),
    });

    await expect(resolveParticleDeviceName('missing-device')).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'Phase3C Particle device-name lookup failed',
      expect.stringContaining('missing-device'),
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  it('should return null on API timeout', async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));

    const resultPromise = resolveParticleDeviceName('slow-device');
    jest.advanceTimersByTime(2000);

    await expect(resultPromise).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'Phase3C Particle device-name lookup failed',
      expect.stringContaining('slow-device'),
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  it('should return null for malformed JSON', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new Error('malformed json')),
    });

    await expect(resolveParticleDeviceName('bad-json-device')).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'Phase3C Particle device-name lookup failed',
      expect.stringContaining('bad-json-device'),
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });
});