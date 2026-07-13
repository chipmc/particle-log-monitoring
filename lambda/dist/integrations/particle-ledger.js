"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParticleLedgerClient = exports.ParticleLedgerNames = void 0;
exports.getDeviceStatus = getDeviceStatus;
exports.getDeviceData = getDeviceData;
exports.getDeviceSettings = getDeviceSettings;
exports.getProductDefaults = getProductDefaults;
// Ledger identifiers are part of the firmware/cloud contract and must stay synchronized with the Generalized Core Counter firmware and the Ledger Architecture ADR.
exports.ParticleLedgerNames = {
    productDefault: 'default-settings',
    deviceSettings: 'device-settings',
    deviceStatus: 'device-status',
    deviceData: 'device-data',
};
const DEFAULT_PARTICLE_API_BASE_URL = 'https://api.particle.io';
const DEFAULT_TIMEOUT_MS = 5000;
class ParticleLedgerClient {
    options;
    constructor(options = {}) {
        this.options = options;
    }
    getDeviceStatus(productId, deviceId) {
        return this.getProductLedgerInstance(exports.ParticleLedgerNames.deviceStatus, productId, deviceId);
    }
    getDeviceData(productId, deviceId) {
        return this.getProductLedgerInstance(exports.ParticleLedgerNames.deviceData, productId, deviceId);
    }
    getDeviceSettings(productId, deviceId) {
        return this.getProductLedgerInstance(exports.ParticleLedgerNames.deviceSettings, productId, deviceId);
    }
    getProductDefaults(productId) {
        return this.getProductLedgerInstance(exports.ParticleLedgerNames.productDefault, productId, productId);
    }
    getProductLedgerInstance(ledgerName, productId, instanceId) {
        return this.getLedgerInstance(ledgerName, productId, instanceId);
    }
    async getLedgerInstance(ledgerName, productId, scopeValue) {
        const accessToken = this.options.accessToken ?? process.env.PARTICLE_ACCESS_TOKEN;
        if (!accessToken) {
            return this.failure(ledgerName, productId, scopeValue, 'auth_failure', 'Particle access token is not configured', false);
        }
        const fetchFn = this.options.fetchFn ?? fetch;
        const apiBaseUrl = (this.options.apiBaseUrl || process.env.PARTICLE_API_BASE_URL || DEFAULT_PARTICLE_API_BASE_URL)
            .replace(/\/+$/, '');
        const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetchFn(`${apiBaseUrl}${buildLedgerInstancePath(productId, ledgerName, scopeValue)}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                },
                signal: controller.signal,
            });
            if (!response.ok) {
                return this.httpFailure(ledgerName, productId, scopeValue, response.status);
            }
            const text = await response.text();
            if (text.trim().length === 0) {
                return this.failure(ledgerName, productId, scopeValue, 'malformed_json', 'Particle ledger response body was empty', false);
            }
            let payload;
            try {
                payload = JSON.parse(text);
            }
            catch {
                return this.failure(ledgerName, productId, scopeValue, 'malformed_json', 'Particle ledger response body was not valid JSON', false);
            }
            if (!payload.instance || !isRecord(payload.instance.data)) {
                return this.failure(ledgerName, productId, scopeValue, 'permanent_failure', 'Particle ledger response missing instance data', false);
            }
            return {
                ok: true,
                ledgerName,
                productId,
                scopeValue,
                data: payload.instance.data,
                instance: payload.instance,
            };
        }
        catch (err) {
            const message = isAbortError(err)
                ? 'Particle ledger request timed out'
                : 'Particle ledger request failed before receiving a response';
            return this.failure(ledgerName, productId, scopeValue, 'network_failure', message, true);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    httpFailure(ledgerName, productId, scopeValue, httpStatus) {
        if (httpStatus === 401 || httpStatus === 403) {
            return this.failure(ledgerName, productId, scopeValue, 'auth_failure', 'Particle rejected ledger authentication', false, httpStatus);
        }
        if (httpStatus === 404) {
            return this.failure(ledgerName, productId, scopeValue, 'missing_ledger', 'Particle ledger instance was not found', false, httpStatus);
        }
        if ([408, 429, 500, 502, 503, 504].includes(httpStatus)) {
            return this.failure(ledgerName, productId, scopeValue, 'retryable_failure', 'Particle ledger service returned a retryable failure', true, httpStatus);
        }
        return this.failure(ledgerName, productId, scopeValue, 'permanent_failure', 'Particle ledger service returned a non-retryable failure', false, httpStatus);
    }
    failure(ledgerName, productId, scopeValue, kind, message, retryable, httpStatus) {
        const result = {
            ok: false,
            ledgerName,
            productId,
            scopeValue,
            error: {
                kind,
                message,
                retryable,
                ...(httpStatus !== undefined && { httpStatus }),
            },
        };
        console.warn('Particle ledger request failed', JSON.stringify({ ledgerName, productId, scopeValue, errorKind: kind, httpStatus }));
        return result;
    }
}
exports.ParticleLedgerClient = ParticleLedgerClient;
function getDeviceStatus(productId, deviceId) {
    return new ParticleLedgerClient().getDeviceStatus(productId, deviceId);
}
function getDeviceData(productId, deviceId) {
    return new ParticleLedgerClient().getDeviceData(productId, deviceId);
}
function getDeviceSettings(productId, deviceId) {
    return new ParticleLedgerClient().getDeviceSettings(productId, deviceId);
}
function getProductDefaults(productId) {
    return new ParticleLedgerClient().getProductDefaults(productId);
}
function buildLedgerInstancePath(productId, ledgerName, scopeValue) {
    return `/v1/products/${encodeURIComponent(productId)}/ledgers/${encodeURIComponent(ledgerName)}/instances/${encodeURIComponent(scopeValue)}`;
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isAbortError(value) {
    return value instanceof Error && value.name === 'AbortError';
}
//# sourceMappingURL=particle-ledger.js.map