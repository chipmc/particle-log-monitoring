export interface ParticleDeviceNameResolution {
  deviceName: string;
  deviceNameResolvedAt: string;
  deviceNameSource: 'particle-api';
}

export interface ParticleDeviceProductIdResolution {
  productId: string;
  productIdResolvedAt: string;
  productIdSource: 'particle-api';
}

interface ParticleDeviceResponse {
  id?: string;
  name?: unknown;
  product_id?: unknown;
  productId?: unknown;
  firmware_product_id?: unknown;
}

const DEFAULT_PARTICLE_API_BASE_URL = 'https://api.particle.io';
const DEFAULT_TIMEOUT_MS = 2000;

export async function resolveParticleDeviceName(
  deviceId: string,
  resolvedAt: Date = new Date()
): Promise<ParticleDeviceNameResolution | null> {
  const payload = await fetchParticleDevice(deviceId, 'Phase3C Particle device-name lookup failed');
  if (!payload) return null;

  try {
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
  }
}

export async function resolveParticleDeviceProductId(
  deviceId: string,
  resolvedAt: Date = new Date()
): Promise<ParticleDeviceProductIdResolution | null> {
  const payload = await fetchParticleDevice(deviceId, 'Phase4 Particle product-id lookup failed');
  if (!payload) return null;

  const productId = normalizeProductId(payload.product_id ?? payload.productId ?? payload.firmware_product_id);
  if (!productId) {
    console.warn(
      'Phase4 Particle product-id lookup failed',
      JSON.stringify({ deviceId }),
      new Error('Particle API response missing product id')
    );
    return null;
  }

  return {
    productId,
    productIdResolvedAt: resolvedAt.toISOString(),
    productIdSource: 'particle-api',
  };
}

async function fetchParticleDevice(
  deviceId: string,
  failureMessage: string
): Promise<ParticleDeviceResponse | null> {
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

    return await response.json() as ParticleDeviceResponse;
  } catch (err) {
    console.warn(
      failureMessage,
      JSON.stringify({ deviceId }),
      err
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeProductId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}