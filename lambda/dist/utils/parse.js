"use strict";
/**
 * Parsing utilities for Particle webhook events
 *
 * Phase 1: Extract current parsing logic (exact behavior preservation)
 * Phase 2A: Add best-effort normalization functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEventBody = parseEventBody;
exports.extractDeviceId = extractDeviceId;
exports.extractTimestamp = extractTimestamp;
exports.extractEventName = extractEventName;
exports.safeParseData = safeParseData;
exports.buildParsedEvent = buildParsedEvent;
exports.generateS3Key = generateS3Key;
exports.normalizeEvent = normalizeEvent;
exports.parseSeverity = parseSeverity;
exports.parseResetCause = parseResetCause;
exports.parseQueueDepth = parseQueueDepth;
exports.parseNetworkState = parseNetworkState;
const crypto_1 = require("crypto");
/**
 * Parse raw request body into ParticleWebhook object
 * Preserves exact current behavior including error handling
 */
function parseEventBody(rawBody) {
    try {
        return JSON.parse(rawBody || '{}');
    }
    catch (err) {
        throw new Error('Invalid JSON body');
    }
}
/**
 * Extract device ID from webhook with fallback logic
 * Preserves exact current priority: coreid -> deviceId -> "unknown"
 */
function extractDeviceId(body) {
    return body.coreid || body.deviceId || 'unknown';
}
/**
 * Extract timestamp from webhook with fallback logic
 * Preserves exact current priority: published_at -> timestamp -> now
 */
function extractTimestamp(body) {
    return body.published_at || body.timestamp || new Date().toISOString();
}
/**
 * Extract event name from webhook
 * Preserves exact current fallback
 */
function extractEventName(body) {
    return body.event || 'unknown';
}
/**
 * Safely parse data field which may be JSON string or plain text
 * Preserves exact current behavior: try parse, fallback to raw
 */
function safeParseData(data) {
    if (typeof data !== 'string') {
        return data;
    }
    try {
        return JSON.parse(data);
    }
    catch {
        // Particle data may be plain text; keep it as-is
        return data;
    }
}
/**
 * Build the parsed event record
 * Preserves exact current "safeRecord" structure
 */
function buildParsedEvent(body, userAgent, sourceIp) {
    const eventName = extractEventName(body);
    const deviceId = extractDeviceId(body);
    const publishedAt = extractTimestamp(body);
    const receivedAt = new Date().toISOString();
    const parsedData = safeParseData(body.data);
    return {
        eventName,
        deviceId,
        publishedAt,
        receivedAt,
        public: body.public,
        fw_version: body.fw_version,
        data: parsedData,
        userAgent,
        sourceIp,
    };
}
/**
 * Generate S3 key for raw event storage
 * Preserves exact current path format:
 * particle-events/YYYY-MM-DD/{eventName}/{deviceId}/timestamp.json
 */
function generateS3Key(eventName, deviceId, publishedAt) {
    const datePrefix = publishedAt.substring(0, 10);
    const safeTimestamp = publishedAt.replace(/[:.]/g, '-');
    return `particle-events/${datePrefix}/${eventName}/${deviceId}/${safeTimestamp}.json`;
}
/**
 * Normalize an inbound event into the additive fields stored in DynamoDB.
 * Parsing is deliberately best effort: unknown or malformed payloads still
 * receive the base envelope fields and are classified as telemetry.event.
 */
function normalizeEvent(body, parsedData, context) {
    const data = parsePayloadObject(parsedData);
    const plane = classifyPlane(body, context.eventName);
    const eventType = classifyEventType(body, context.eventName, plane, data);
    const serialLogLine = getSerialLogLine(body);
    const severity = plane === 'serial' ? parseSeverity(serialLogLine) : null;
    const sourceType = plane === 'serial'
        ? 'serial-forwarder'
        : body.sourceType || 'particle-webhook';
    const normalized = {
        schemaVersion: '1.0',
        eventId: createEventId(context),
        projectId: body.projectId || 'generalized-core-counter',
        plane,
        eventType,
        eventVersion: '1.0',
        sourceType,
        isSyntheticTime: !body.published_at && !body.timestamp,
        rawRef: {
            s3Key: context.s3Key,
        },
    };
    addString(normalized, 'deviceName', body.deviceName);
    addString(normalized, 'collectorId', body.collectorId);
    if (severity)
        normalized.severity = severity;
    if (plane === 'serial')
        addSerialFields(normalized, body, serialLogLine);
    addNumber(normalized, 'battery', getField(data, body, 'battery'));
    addNumber(normalized, 'connectTime', getField(data, body, 'connecttime'));
    addNumber(normalized, 'resetCount', getField(data, body, 'resets'));
    addNumber(normalized, 'alertCount', getField(data, body, 'alerts'));
    addNumber(normalized, 'occupancy', getField(data, body, 'occupancy'));
    addNumber(normalized, 'dailyOccupancy', getField(data, body, 'dailyoccupancy'));
    addNumber(normalized, 'temperature', getField(data, body, 'temp') ?? getField(data, body, 'temperature'));
    const fwVersion = getField(data, body, 'fw_version') ?? body.fw_version;
    if (typeof fwVersion === 'string' && fwVersion.length > 0) {
        normalized.fwVersion = fwVersion;
    }
    else if (typeof fwVersion === 'number' && Number.isFinite(fwVersion)) {
        normalized.fwVersion = String(fwVersion);
    }
    return normalized;
}
/**
 * Parse serial log severity without rejecting unfamiliar log formats.
 */
function parseSeverity(logLine) {
    if (typeof logLine !== 'string')
        return null;
    const match = logLine.match(/\b(TRACE|INFO|WARN|ERROR)\b/i);
    return match ? match[1].toUpperCase() : null;
}
// Reserved enrichment hooks for later Phase 2 work.
function parseResetCause( /* params TBD */) {
    return null;
}
function parseQueueDepth(logLine) {
    if (typeof logLine !== 'string')
        return null;
    const match = logLine.match(/(?:queue|queued|publishqueue|inflight)[^0-9]*(\d+)/i);
    if (!match)
        return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
}
function parseNetworkState( /* params TBD */) {
    return null;
}
function createEventId(context) {
    return (0, crypto_1.createHash)('sha256')
        .update([
        context.deviceId,
        context.eventName,
        context.eventTime,
        context.s3Key,
    ].join('\u0000'))
        .digest('hex');
}
function classifyPlane(body, eventName) {
    if (body.sourceType === 'serial-forwarder' || eventName === 'serialLog') {
        return 'serial';
    }
    if (/(watchdog|status|reset|boot|fault)/i.test(eventName)) {
        return 'forensic';
    }
    return 'telemetry';
}
function classifyEventType(body, eventName, plane, data) {
    const name = eventName.toLowerCase();
    const sourceEventType = body.eventType?.toUpperCase();
    if (plane === 'serial') {
        switch (sourceEventType || eventName.toUpperCase()) {
            case 'LOG':
                return 'serial.log';
            case 'SERIAL_CONNECTED':
                return 'serial.lifecycle.connected';
            case 'SERIAL_DISCONNECTED':
                return 'serial.lifecycle.disconnected';
            case 'SERIAL_MISSING':
                return 'serial.lifecycle.missing';
            default:
                if (name === 'seriallog' && (!sourceEventType || !!body.logLine))
                    return 'serial.log';
                return 'serial.event';
        }
    }
    if (name.includes('watchdog'))
        return 'fault.watchdog';
    if (name.includes('status'))
        return 'telemetry.status';
    const keys = new Set(Object.keys(data || {}).map(key => key.toLowerCase()));
    if (keys.has('occupancy') || keys.has('dailyoccupancy')) {
        return 'telemetry.occupancy';
    }
    if (['battery', 'connecttime', 'resets', 'alerts', 'temperature', 'temp']
        .some(key => keys.has(key))) {
        return 'telemetry.health';
    }
    return 'telemetry.event';
}
function parsePayloadObject(data) {
    if (data && typeof data === 'object' && !Array.isArray(data))
        return data;
    if (typeof data !== 'string')
        return null;
    const decoded = data
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'");
    for (const candidate of [decoded, `{${decoded}`, `{${decoded}}`]) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        }
        catch {
            // Continue through best-effort candidates.
        }
    }
    return null;
}
function getField(data, body, field) {
    const dataEntry = data
        ? Object.entries(data).find(([key]) => key.toLowerCase() === field.toLowerCase())
        : undefined;
    if (dataEntry)
        return dataEntry[1];
    const bodyEntry = Object.entries(body).find(([key]) => key.toLowerCase() === field.toLowerCase());
    return bodyEntry?.[1];
}
function addNumber(target, field, value) {
    if (value === null || value === undefined || value === '')
        return;
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numberValue))
        target[field] = numberValue;
}
function addString(target, field, value) {
    if (typeof value === 'string' && value.length > 0)
        target[field] = value;
}
function addSerialFields(normalized, body, serialLogLine) {
    if (serialLogLine) {
        addString(normalized, 'serialLogLine', truncate(serialLogLine, 500));
    }
    normalized.serialCategory = parseSerialCategory(serialLogLine);
    const networkState = parseSerialNetworkState(body.eventType, serialLogLine);
    if (networkState)
        normalized.networkState = networkState;
    const lowerLine = serialLogLine?.toLowerCase() || '';
    normalized.reconnectDetected = /(reconnect|retry)/.test(lowerLine);
    normalized.watchdogDetected = /watchdog/.test(lowerLine);
    normalized.resetDetected = /(reset|reboot|panic)/.test(lowerLine);
    const queueDepth = parseQueueDepth(serialLogLine);
    if (queueDepth !== null) {
        normalized.queueDepth = queueDepth;
    }
}
function getSerialLogLine(body) {
    if (typeof body.logLine === 'string')
        return body.logLine;
    if (typeof body.data === 'string' && body.eventType?.toUpperCase() === 'LOG')
        return body.data;
    return undefined;
}
function parseSerialCategory(logLine) {
    if (typeof logLine !== 'string' || logLine.length === 0)
        return null;
    const lower = logLine.toLowerCase();
    if (/(modem|ncp|cellular|sim)/.test(lower))
        return 'modem';
    if (/(cloud|network|connect|reconnect|disconnect)/.test(lower))
        return 'network';
    if (/(battery|power|pmic|vbat|charge)/.test(lower))
        return 'power';
    if (/watchdog/.test(lower))
        return 'watchdog';
    if (/(queue|queued|publishqueue|inflight)/.test(lower))
        return 'queue';
    if (/(reset|reboot|panic)/.test(lower))
        return 'reset';
    return 'other';
}
function parseSerialNetworkState(eventType, logLine) {
    const normalizedEventType = eventType?.toUpperCase();
    if (normalizedEventType === 'SERIAL_CONNECTED')
        return 'connected';
    if (normalizedEventType === 'SERIAL_DISCONNECTED')
        return 'disconnected';
    if (normalizedEventType === 'SERIAL_MISSING')
        return 'missing';
    const lower = logLine?.toLowerCase() || '';
    if (/(reconnect|retry)/.test(lower))
        return 'reconnecting';
    if (/(disconnect|disconnected)/.test(lower))
        return 'disconnected';
    if (/(connect|connected|cloud connected)/.test(lower))
        return 'connected';
    return null;
}
function truncate(value, maxLength) {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
}
//# sourceMappingURL=parse.js.map