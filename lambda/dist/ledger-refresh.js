"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshDeviceStatusLedger = refreshDeviceStatusLedger;
exports.clearDeviceProductIdCacheForTests = clearDeviceProductIdCacheForTests;
const particle_api_1 = require("./integrations/particle-api");
const particle_ledger_1 = require("./integrations/particle-ledger");
const current_state_1 = require("./storage/current-state");
const productIdByDeviceId = new Map();
async function refreshDeviceStatusLedger(input) {
    if (!isLedgerRefreshEnabled()) {
        logLedgerRefresh({ deviceId: input.deviceId, result: 'skipped', reason: 'feature_disabled' });
        return 'disabled';
    }
    if (!isDeviceAllowListed(input.deviceId)) {
        logLedgerRefresh({ deviceId: input.deviceId, result: 'skipped', reason: 'device_not_allowlisted' });
        return 'not_allow_listed';
    }
    try {
        const productId = await resolveProductId(input.body, input.deviceId, input.fetchedAt);
        if (!productId) {
            logLedgerRefresh({ deviceId: input.deviceId, result: 'skipped', reason: 'missing_product_id' });
            return 'missing_product_id';
        }
        const ledgerClient = input.ledgerClient || new particle_ledger_1.ParticleLedgerClient();
        const ledgerResult = await ledgerClient.getDeviceStatus(productId, input.deviceId);
        if (!ledgerResult.ok) {
            logLedgerRefresh({
                deviceId: input.deviceId,
                productId,
                result: 'failed',
                httpStatus: ledgerResult.error.httpStatus,
                errorKind: ledgerResult.error.kind,
            });
            return 'not_found_or_failed';
        }
        const ledgerUpdatedAt = ledgerResult.instance.updated_at;
        if (!ledgerUpdatedAt) {
            logLedgerRefresh({ deviceId: input.deviceId, productId, result: 'skipped', reason: 'missing_updated_at' });
            return 'missing_updated_at';
        }
        if (input.previous?.deviceStatusLedgerUpdatedAt && input.previous.deviceStatusLedgerUpdatedAt >= ledgerUpdatedAt) {
            logLedgerRefresh({ deviceId: input.deviceId, productId, ledgerUpdatedAt, result: 'unchanged' });
            return 'stale';
        }
        const updateResult = await (0, current_state_1.updateDeviceStatusLedgerSnapshot)(input.tableName, input.projectId, input.deviceId, {
            updatedAt: ledgerUpdatedAt,
            fetchedAt: (input.fetchedAt || new Date()).toISOString(),
            sizeBytes: ledgerResult.instance.size_bytes,
            data: ledgerResult.data,
        });
        logLedgerRefresh({
            deviceId: input.deviceId,
            productId,
            ledgerUpdatedAt,
            result: updateResult === 'updated' ? 'updated' : 'unchanged',
        });
        return updateResult;
    }
    catch (err) {
        logLedgerRefresh({ deviceId: input.deviceId, result: 'failed', errorKind: 'exception' });
        return 'not_found_or_failed';
    }
}
function logLedgerRefresh(input) {
    console.info('Ledger refresh', JSON.stringify({
        deviceId: input.deviceId,
        ...(input.productId && { productId: input.productId }),
        ledgerName: particle_ledger_1.ParticleLedgerNames.deviceStatus,
        ...(input.ledgerUpdatedAt && { ledgerUpdatedAt: input.ledgerUpdatedAt }),
        result: input.result,
        ...(input.reason && { reason: input.reason }),
        ...(input.httpStatus !== undefined && { httpStatus: input.httpStatus }),
        ...(input.httpStatus === undefined && input.errorKind && { errorKind: input.errorKind }),
    }));
}
function isLedgerRefreshEnabled() {
    return process.env.PARTICLE_LEDGER_REFRESH_ENABLED === 'true';
}
function isDeviceAllowListed(deviceId) {
    return parseAllowList(process.env.PARTICLE_LEDGER_REFRESH_DEVICE_IDS).has(deviceId);
}
function parseAllowList(value) {
    return new Set((value || '').split(',').map((entry) => entry.trim()).filter(Boolean));
}
async function resolveProductId(body, deviceId, resolvedAt) {
    const productId = normalizeProductId(body.product_id ?? body.productId);
    if (productId) {
        productIdByDeviceId.set(deviceId, productId);
        return productId;
    }
    const cachedProductId = productIdByDeviceId.get(deviceId);
    if (cachedProductId)
        return cachedProductId;
    const resolution = await (0, particle_api_1.resolveParticleDeviceProductId)(deviceId, resolvedAt);
    if (!resolution?.productId)
        return null;
    productIdByDeviceId.set(deviceId, resolution.productId);
    return resolution.productId;
}
function normalizeProductId(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    if (typeof value === 'string' && value.trim().length > 0)
        return value.trim();
    return null;
}
function clearDeviceProductIdCacheForTests() {
    productIdByDeviceId.clear();
}
//# sourceMappingURL=ledger-refresh.js.map