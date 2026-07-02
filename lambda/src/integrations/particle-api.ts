export interface ParticleDeviceNameResolution {
  deviceName: string;
  deviceNameResolvedAt: string;
  deviceNameSource: 'particle-api';
}

interface ParticleDeviceResponse {
  id?: string;
  name?: unknown;
}

const DEFAULT_PARTICLE_API_BASE_URL = 'https://api.particle.io';
const DEFAULT_TIMEOUT_MS = 2000;

export async function resolveParticleDeviceName(
  deviceId: string,
  resolvedAt: Date = new Date()
): Promise<ParticleDeviceNameResolution | null> {
  const accessToken = process.env.PARTICLE_ACCESS_TOKEN;
  if (!accessToken) return null;

  const apiBaseUrl = (process.env.PARTICLE_API_BASE_URL || DEFAULT_PARTICLE_API_BASE_URL).replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBaseUrl}/v1/devices/${encodeURIComponent(deviceId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Particle API returned ${response.status}`);
    }

    const payload = await response.json() as ParticleDeviceResponse;
    if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
      throw new Error('Particle API response missing device name');
    }

    return {
      deviceName: payload.name,
      deviceNameResolvedAt: resolvedAt.toISOString(),
      deviceNameSource: 'particle-api',
    };
  } catch (err) {
    console.warn(
      'Phase3C Particle device-name lookup failed',
      JSON.stringify({ deviceId }),
      err
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}