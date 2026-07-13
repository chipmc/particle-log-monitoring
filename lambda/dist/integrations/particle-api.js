"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveParticleDeviceName = resolveParticleDeviceName;
exports.resolveParticleDeviceProductId = resolveParticleDeviceProductId;
const DEFAULT_PARTICLE_API_BASE_URL = 'https://api.particle.io';
const DEFAULT_TIMEOUT_MS = 2000;
async function resolveParticleDeviceName(deviceId, resolvedAt = new Date()) {
    const payload = await fetchParticleDevice(deviceId, 'Phase3C Particle device-name lookup failed');
    if (!payload)
        return null;
    try {
        if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
            throw new Error('Particle API response missing device name');
        }
        return {
            deviceName: payload.name,
            deviceNameResolvedAt: resolvedAt.toISOString(),
            deviceNameSource: 'particle-api',
        };
    }
    catch (err) {
        console.warn('Phase3C Particle device-name lookup failed', JSON.stringify({ deviceId }), err);
        return null;
    }
}
async function resolveParticleDeviceProductId(deviceId, resolvedAt = new Date()) {
    const payload = await fetchParticleDevice(deviceId, 'Phase4 Particle product-id lookup failed');
    if (!payload)
        return null;
    const productId = normalizeProductId(payload.product_id ?? payload.productId ?? payload.firmware_product_id);
    if (!productId) {
        console.warn('Phase4 Particle product-id lookup failed', JSON.stringify({ deviceId }), new Error('Particle API response missing product id'));
        return null;
    }
    return {
        productId,
        productIdResolvedAt: resolvedAt.toISOString(),
        productIdSource: 'particle-api',
    };
}
async function fetchParticleDevice(deviceId, failureMessage) {
    const accessToken = process.env.PARTICLE_ACCESS_TOKEN;
    if (!accessToken)
        return null;
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
        return await response.json();
    }
    catch (err) {
        console.warn(failureMessage, JSON.stringify({ deviceId }), err);
        return null;
    }
    finally {
        clearTimeout(timeout);
    }
}
function normalizeProductId(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    if (typeof value === 'string' && value.trim().length > 0)
        return value.trim();
    return null;
}
//# sourceMappingURL=particle-api.js.map