'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  TransientWatchError,
  buildFleetSummary,
  buildWatchEntries,
  classifyTimelineEvent,
  collectNewTimelineEvents,
  createWatchState,
  detectCurrentStateChanges,
  enrichDeviceNames,
  fleetSummaryJson,
  formatDuration,
  formatWatchEntry,
  getWatchBannerLines,
  isDeviceId,
  loadDeviceInventory,
  loadLocalOperatorConfig,
  parseEnvFile,
  parseOptions,
  queryTimelineFromDynamo,
  resolveDeviceSelector,
  runWatchLoop,
  watchEntryFromEvent,
} = require('./telemetry');

const telemetryPath = path.join(__dirname, 'telemetry');

function runTelemetry(args) {
  return spawnSync(process.execPath, [telemetryPath, ...args], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
    },
  });
}

function watchOptions(overrides = {}) {
  return {
    json: false,
    sinceMs: 0,
    intervalSeconds: 3,
    includeTypes: null,
    excludeTypes: new Set(),
    serialOnly: false,
    raw: false,
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    eventTime: '2026-07-14T08:00:00.000Z',
    eventName: 'Ubidots-Sensor-Hook-v1',
    eventId: 'event-1',
    s3Key: 's3/event-1',
    eventType: 'telemetry.occupancy',
    plane: 'telemetry',
    occupancy: 14,
    battery: 87,
    ...overrides,
  };
}

function dynamoItem(overrides = {}) {
  return {
    deviceId: { S: overrides.deviceId || 'device123' },
    eventTime: { S: overrides.eventTime || '2026-07-14T08:00:00.000Z' },
    eventName: { S: overrides.eventName || 'serialLog' },
    eventId: { S: overrides.eventId || 'event-1' },
    s3Key: { S: overrides.s3Key || 's3/event-1' },
    eventType: { S: overrides.eventType || 'serial.log' },
    plane: { S: overrides.plane || 'serial' },
    serialLogLine: { S: overrides.serialLogLine || 'boot' },
  };
}

test('top-level help exits successfully without external configuration', () => {
  for (const args of [['--help'], ['help']]) {
    const result = runTelemetry(args);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:[\s\S]*\.\/tools\/telemetry watch <name-or-device-id>/);
    assert.doesNotMatch(result.stderr, /AWS|region|credentials/i);
  }
});

test('watch help exits successfully without external configuration', () => {
  for (const args of [['watch', '--help'], ['help', 'watch']]) {
    const result = runTelemetry(args);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:[\s\S]*\.\/tools\/telemetry watch <name-or-device-id>/);
    assert.match(result.stdout, /--interval <seconds>/);
    assert.doesNotMatch(result.stderr, /AWS|region|credentials/i);
  }
});

test('command help exits successfully without external configuration', () => {
  const result = runTelemetry(['timeline', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Timeline lookback window/);
  assert.doesNotMatch(result.stderr, /AWS|region|credentials/i);
});

test('fleet help exits successfully without external configuration', () => {
  for (const args of [['fleet', '--help'], ['help', 'fleet']]) {
    const result = runTelemetry(args);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /fleet-summary\.v1/);
    assert.match(result.stdout, /--product-id <id>/);
    assert.doesNotMatch(result.stderr, /AWS|region|credentials/i);
  }
});

test('unknown commands fail before external configuration is loaded', () => {
  const result = runTelemetry(['frobnicate']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /ERROR: Unknown command: frobnicate/);
  assert.doesNotMatch(result.stderr, /AWS region|credentials|CloudFormation/i);
});

test('Particle-resolved name works for device selector resolution', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ name: 'Boron-Dev-09' }),
  });

  try {
    const devices = [{
      projectId: 'generalized-core-counter',
      deviceId: 'e00fce68399ee6244a963935',
      lastEventTime: '2026-07-13T12:59:59.369Z',
    }];
    const context = {
      particleAccessToken: 'test-token',
      particleApiBaseUrl: 'https://particle.example.test',
      nameCache: new Map(),
    };

    await enrichDeviceNames(context, devices, { required: false });

    assert.equal(devices[0].deviceName, 'Boron-Dev-09');
    assert.equal(isDeviceId('Boron-Dev-09'), false);
    assert.equal(resolveDeviceSelector(devices, 'Boron-Dev-09').deviceId, 'e00fce68399ee6244a963935');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Particle-resolved name works for timeline selector resolution', async () => {
  const devices = [{
    projectId: 'generalized-core-counter',
    deviceId: 'e00fce68399ee6244a963935',
    deviceName: 'Boron-Dev-09',
    lastEventTime: '2026-07-13T12:59:59.369Z',
  }];

  assert.equal(resolveDeviceSelector(devices, 'boron-dev-09').deviceId, 'e00fce68399ee6244a963935');
  assert.equal(resolveDeviceSelector(devices, 'Boron-Dev').deviceId, 'e00fce68399ee6244a963935');
});

test('ambiguous partial names list matching names and ids', () => {
  const devices = [
    { deviceId: 'e00fce68399ee6244a963935', deviceName: 'Boron-Dev-09' },
    { deviceId: 'e00fce688e592afaf23ac4fb', deviceName: 'Boron-Dev-10' },
  ];

  assert.throws(
    () => resolveDeviceSelector(devices, 'boron-dev'),
    /Ambiguous device selector: boron-dev[\s\S]*Boron-Dev-09[\s\S]*Boron-Dev-10/
  );
});

test('watch resolves exact device IDs with the shared selector', () => {
  const devices = [{ deviceId: 'e00fce68399ee6244a963935', deviceName: 'Boron-Dev-09' }];

  assert.equal(resolveDeviceSelector(devices, 'e00fce68399ee6244a963935').deviceName, 'Boron-Dev-09');
});

test('name and ID selectors produce identical resolved-device queries', () => {
  const devices = [{ deviceId: 'e00fce68399ee6244a963935', deviceName: 'Boron-Dev-09' }];

  assert.equal(resolveDeviceSelector(devices, 'Boron-Dev-09').deviceId, resolveDeviceSelector(devices, 'e00fce68399ee6244a963935').deviceId);
});

test('watch option parsing supports interval, since, filters, json, and raw', () => {
  const options = parseOptions(['--interval', '2.5', '--since', '5m', '--types', 'serial,status', '--exclude', 'event', '--json', '--raw', 'P2-NewCode-Dev']);

  assert.equal(options.intervalSeconds, 2.5);
  assert.equal(options.sinceMs, 300000);
  assert.deepEqual([...options.includeTypes].sort(), ['SERIAL', 'STATUS']);
  assert.deepEqual([...options.excludeTypes], ['EVENT']);
  assert.equal(options.json, true);
  assert.equal(options.raw, true);
  assert.deepEqual(options.positionals, ['P2-NewCode-Dev']);
});

test('fleet option parsing supports product id and verbose', () => {
  const options = parseOptions(['--product-id', '42131', '--verbose', '--json']);

  assert.equal(options.productId, '42131');
  assert.equal(options.verbose, true);
  assert.equal(options.json, true);
});

test('local operator config prefers environment token over secrets file', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-home-'));
  fs.mkdirSync(path.join(homeDir, '.particle-log-monitoring'), { recursive: true });
  fs.writeFileSync(path.join(homeDir, '.particle-log-monitoring', 'secrets.env'), [
    'PARTICLE_ACCESS_TOKEN=file-token',
    'PARTICLE_WEBHOOK_SECRET=file-webhook-secret',
    'PARTICLE_API_BASE_URL=https://particle.file.test',
  ].join('\n'));

  const config = loadLocalOperatorConfig({
    PARTICLE_ACCESS_TOKEN: 'env-token',
  }, homeDir);

  assert.deepEqual(config, {
    PARTICLE_ACCESS_TOKEN: 'env-token',
    PARTICLE_WEBHOOK_SECRET: 'file-webhook-secret',
    PARTICLE_API_BASE_URL: 'https://particle.file.test',
  });
});

test('secrets env parser supports export and quoted values', () => {
  assert.deepEqual(parseEnvFile(`
# local operator cache
export PARTICLE_ACCESS_TOKEN="file-token"
PARTICLE_WEBHOOK_SECRET='webhook-secret'
PARTICLE_API_BASE_URL=https://particle.example.test
`), {
    PARTICLE_ACCESS_TOKEN: 'file-token',
    PARTICLE_WEBHOOK_SECRET: 'webhook-secret',
    PARTICLE_API_BASE_URL: 'https://particle.example.test',
  });
});

test('fleet inventory missing token reports local credential guidance', async () => {
  await assert.rejects(
    () => loadDeviceInventory({
      options: { projectId: 'generalized-core-counter' },
      deviceCurrentStateTableName: 'current-state-table',
      particleAccessToken: '',
      particleApiBaseUrl: 'https://particle.example.test',
      nameCache: new Map(),
      awsJson: () => ({ Items: [] }),
    }, { productId: '42131' }),
    (err) => {
      assert.match(err.message, /local PARTICLE_ACCESS_TOKEN/);
      assert.match(err.message, /secrets\.env/);
      assert.doesNotMatch(err.message, /deployed Lambda|token-/i);
      return true;
    }
  );
});

test('fleet summary joins product inventory, current state, and runtime projection', () => {
  const summary = buildFleetSummary([
    {
      projectId: 'generalized-core-counter',
      deviceId: 'device-a',
      deviceName: 'Counter A',
      productId: '42131',
      hasProductInventory: true,
      hasCurrentState: true,
      fwVersion: '14',
      lastEventTime: '2026-07-14T08:00:00.000Z',
      lastEventType: 'telemetry.occupancy',
      deviceStatusLedgerUpdatedAt: '2026-07-14T08:01:00.000Z',
      deviceStatusLedgerData: { connection: { state: 'connected' } },
      deviceDataLedgerUpdatedAt: '2026-07-14T08:01:30.000Z',
      particle: { connected: true, system_firmware_version: '5.8.0', last_heard: '2026-07-14T08:02:00.000Z' },
    },
    {
      deviceId: 'device-b',
      deviceName: 'Counter B',
      productId: '42131',
      hasProductInventory: true,
      hasCurrentState: false,
      particle: { connected: false, system_firmware_version: '5.7.0' },
    },
  ], { productId: '42131', generatedAt: '2026-07-14T08:03:00.000Z' });

  assert.equal(summary.schema, 'fleet-summary.v1');
  assert.deepEqual(summary.coverage, {
    inventory: 2,
    currentState: 1,
    runtimeStatus: 1,
    deviceData: 1,
  });
  assert.deepEqual(summary.connected, { connected: 1, disconnected: 1, unknown: 0 });
  assert.deepEqual(summary.distributions.firmware, [
    { value: '14', count: 1 },
    { value: '<unknown>', count: 1 },
  ]);
  assert.deepEqual(summary.distributions.deviceOs, [
    { value: '5.7.0', count: 1 },
    { value: '5.8.0', count: 1 },
  ]);
  assert.equal(summary.devices[0].runtimeConnectionState, 'connected');
});

test('fleet summary JSON omits verbose metadata by default', () => {
  const summary = buildFleetSummary([
    {
      projectId: 'generalized-core-counter',
      deviceId: 'device-a',
      deviceName: 'Counter A',
      hasProductInventory: true,
      hasCurrentState: true,
      lastEventType: 'telemetry.occupancy',
      particle: { connected: true },
    },
  ], { productId: '42131', generatedAt: '2026-07-14T08:03:00.000Z' });

  assert.equal(fleetSummaryJson(summary, { verbose: false }).devices[0].metadata, undefined);
  assert.deepEqual(fleetSummaryJson(summary, { verbose: false }).coverage, {
    inventory: 1,
    currentState: 1,
    runtimeStatus: 0,
    deviceData: 0,
  });
  assert.equal(fleetSummaryJson(summary, { verbose: true }).devices[0].metadata.lastEventType, 'telemetry.occupancy');
});

test('fleet inventory uses product inventory names without duplicate device lookups', async () => {
  const originalFetch = global.fetch;
  const fetchUrls = [];
  global.fetch = async (url) => {
    fetchUrls.push(String(url));
    assert.match(String(url), /\/v1\/products\/42131\/devices/);
    return {
      ok: true,
      json: async () => ({
        devices: [
          { id: 'device-a', name: 'Counter A', connected: true, system_firmware_version: '5.8.0' },
          { id: 'device-b', name: 'Counter B', connected: false, system_firmware_version: '5.7.0' },
        ],
      }),
    };
  };

  try {
    const devices = await loadDeviceInventory({
      options: { projectId: 'generalized-core-counter' },
      deviceCurrentStateTableName: 'current-state-table',
      particleAccessToken: 'test-token',
      particleApiBaseUrl: 'https://particle.example.test',
      nameCache: new Map(),
      awsJson: () => ({
        Items: [{
          projectId: { S: 'generalized-core-counter' },
          deviceId: { S: 'device-a' },
          fwVersion: { S: '14' },
          lastEventTime: { S: '2026-07-14T08:00:00.000Z' },
          deviceStatusLedgerUpdatedAt: { S: '2026-07-14T08:01:00.000Z' },
          deviceStatusLedgerData: { M: { connection: { M: { state: { S: 'connected' } } } } },
        }],
      }),
    }, { productId: '42131' });

    assert.equal(fetchUrls.length, 1);
    assert.deepEqual(devices.map(device => device.deviceName), ['Counter A', 'Counter B']);
    assert.equal(devices[0].hasCurrentState, true);
    assert.equal(devices[1].hasCurrentState, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('watch establishes an initial cursor without printing existing events', () => {
  const state = createWatchState(watchOptions(), new Date('2026-07-14T08:00:10.000Z'));
  const entries = buildWatchEntries([
    event({ eventTime: '2026-07-14T08:00:01.000Z', eventId: 'a', s3Key: 'a' }),
    event({ eventTime: '2026-07-14T08:00:02.000Z', eventId: 'b', s3Key: 'b' }),
  ], null, state, watchOptions());

  assert.deepEqual(entries, []);
  assert.equal(state.cursor.eventTime, '2026-07-14T08:00:02.000Z');
  assert.equal(state.cursor.id, 'b');
});

test('default startup prints no historical Timeline rows but emits initial runtime context', () => {
  const state = createWatchState(watchOptions(), new Date('2026-07-14T08:00:10.000Z'));
  const entries = buildWatchEntries([
    event({ eventTime: '2026-07-14T08:00:01.000Z', eventId: 'serial', s3Key: 'serial', eventName: 'serialLog', serialLogLine: 'boot' }),
  ], { deviceStatusLedgerUpdatedAt: '2026-07-14T08:00:02.000Z' }, state, watchOptions());

  assert.deepEqual(entries.map(entry => [entry.category, entry.summary]), [
    ['RUNTIME', 'device-status snapshot available'],
  ]);
  assert.equal(state.cursor.id, 'serial');
});

test('watch returns new events only and suppresses duplicates', () => {
  const state = createWatchState(watchOptions(), new Date('2026-07-14T08:00:10.000Z'));
  buildWatchEntries([event({ eventTime: '2026-07-14T08:00:01.000Z', eventId: 'a', s3Key: 'a' })], null, state, watchOptions());

  const entries = buildWatchEntries([
    event({ eventTime: '2026-07-14T08:00:01.000Z', eventId: 'a', s3Key: 'a' }),
    event({ eventTime: '2026-07-14T08:00:02.000Z', eventId: 'b', s3Key: 'b', occupancy: 2 }),
  ], null, state, watchOptions());

  assert.equal(entries.length, 1);
  assert.equal(entries[0].event.eventId, 'b');
});

test('watch handles identical timestamps with distinct event IDs', () => {
  const state = { cursor: { eventTime: '2026-07-14T08:00:00.000Z', id: 'a' }, seenEventIds: new Set(['a']) };
  const events = collectNewTimelineEvents([
    event({ eventTime: '2026-07-14T08:00:00.000Z', eventId: 'a', s3Key: 'a' }),
    event({ eventTime: '2026-07-14T08:00:00.000Z', eventId: 'b', s3Key: 'b' }),
  ], state);

  assert.equal(events.length, 1);
  assert.equal(events[0].eventId, 'b');
});

test('watch emits timeline events oldest first', () => {
  const state = createWatchState(watchOptions({ sinceMs: 60000 }), new Date('2026-07-14T08:00:10.000Z'));
  const entries = buildWatchEntries([
    event({ eventTime: '2026-07-14T08:00:03.000Z', eventId: 'c', s3Key: 'c' }),
    event({ eventTime: '2026-07-14T08:00:01.000Z', eventId: 'a', s3Key: 'a' }),
    event({ eventTime: '2026-07-14T08:00:02.000Z', eventId: 'b', s3Key: 'b' }),
  ], null, state, watchOptions({ sinceMs: 60000 }));

  assert.deepEqual(entries.map(entry => entry.event.eventId), ['a', 'b', 'c']);
});

test('--since prints first-poll serial rows oldest-first', () => {
  const options = watchOptions({ sinceMs: 60000 });
  const state = createWatchState(options, new Date('2026-07-14T08:00:10.000Z'));
  const entries = buildWatchEntries([
    event({ eventTime: '2026-07-14T08:00:02.000Z', eventId: '2', s3Key: '2', eventName: 'serialLog', serialLogLine: 'second' }),
    event({ eventTime: '2026-07-14T08:00:01.000Z', eventId: '1', s3Key: '1', eventName: 'serialLog', serialLogLine: 'first' }),
  ], null, state, options);

  assert.deepEqual(entries.map(entry => entry.summary), ['first', 'second']);
});

test('cursor prevents duplicates after initial history', () => {
  const options = watchOptions({ sinceMs: 60000 });
  const state = createWatchState(options, new Date('2026-07-14T08:00:10.000Z'));
  buildWatchEntries([
    event({ eventTime: '2026-07-14T08:00:01.000Z', eventId: '1', s3Key: '1', eventName: 'serialLog', serialLogLine: 'first' }),
  ], null, state, options);
  const entries = buildWatchEntries([
    event({ eventTime: '2026-07-14T08:00:01.000Z', eventId: '1', s3Key: '1', eventName: 'serialLog', serialLogLine: 'first' }),
  ], null, state, options);

  assert.deepEqual(entries, []);
});

test('watch formats serialLog lines and truncates by default', () => {
  const line = 'x'.repeat(220);
  const entry = watchEntryFromEvent(event({
    eventName: 'serialLog',
    eventType: 'serial.log',
    plane: 'serial',
    serialLogLine: line,
  }), watchOptions());

  assert.equal(entry.category, 'SERIAL');
  assert.equal(entry.summary.length, 160);
  assert.match(entry.summary, /\.\.\.$/);
});

test('watch raw mode preserves full serial content', () => {
  const line = 'x'.repeat(220);
  const entry = watchEntryFromEvent(event({ eventName: 'serialLog', serialLogLine: line }), watchOptions({ raw: true }));

  assert.equal(entry.summary, line);
});

test('watch preserves rapid serial burst order', () => {
  const state = createWatchState(watchOptions({ sinceMs: 60000 }), new Date('2026-07-14T08:00:10.000Z'));
  const entries = buildWatchEntries([
    event({ eventTime: '2026-07-14T08:00:00.003Z', eventId: '3', s3Key: '3', eventName: 'serialLog', serialLogLine: 'third' }),
    event({ eventTime: '2026-07-14T08:00:00.001Z', eventId: '1', s3Key: '1', eventName: 'serialLog', serialLogLine: 'first' }),
    event({ eventTime: '2026-07-14T08:00:00.002Z', eventId: '2', s3Key: '2', eventName: 'serialLog', serialLogLine: 'second' }),
  ], null, state, watchOptions({ sinceMs: 60000 }));

  assert.deepEqual(entries.map(entry => entry.summary), ['first', 'second', 'third']);
});

test('Particle status events classify as lifecycle', () => {
  assert.equal(classifyTimelineEvent(event({ eventName: 'status', eventType: 'particle.status', occupancy: undefined, battery: undefined })).category, 'LIFECYCLE');
});

test('watch detects current-state snapshot timestamp changes', () => {
  const entries = detectCurrentStateChanges(
    { deviceStatusLedgerUpdatedAt: '2026-07-14T08:00:30.104Z', deviceDataLedgerUpdatedAt: '2026-07-14T08:00:30.105Z' },
    { deviceStatusLedgerUpdatedAt: '2026-07-14T08:00:00.000Z', deviceDataLedgerUpdatedAt: undefined }
  );

  assert.deepEqual(entries.map(entry => [entry.category, entry.summary]), [
    ['RUNTIME', 'device-status snapshot updated'],
    ['DATA', 'device-data snapshot updated'],
  ]);
});

test('initial RUNTIME snapshot is emitted once', () => {
  const state = createWatchState(watchOptions(), new Date('2026-07-14T08:00:10.000Z'));
  const first = buildWatchEntries([], { deviceStatusLedgerUpdatedAt: '2026-07-14T08:00:30.104Z' }, state, watchOptions());
  const second = buildWatchEntries([], { deviceStatusLedgerUpdatedAt: '2026-07-14T08:00:30.104Z' }, state, watchOptions());

  assert.deepEqual(first.map(entry => [entry.category, entry.summary]), [['RUNTIME', 'device-status snapshot available']]);
  assert.deepEqual(second, []);
});

test('initial DATA snapshot is emitted once', () => {
  const state = createWatchState(watchOptions(), new Date('2026-07-14T08:00:10.000Z'));
  const first = buildWatchEntries([], { deviceDataLedgerUpdatedAt: '2026-07-14T08:00:30.105Z' }, state, watchOptions());
  const second = buildWatchEntries([], { deviceDataLedgerUpdatedAt: '2026-07-14T08:00:30.105Z' }, state, watchOptions());

  assert.deepEqual(first.map(entry => [entry.category, entry.summary]), [['DATA', 'device-data snapshot available']]);
  assert.deepEqual(second, []);
});

test('device-status Ledger changes classify as runtime', () => {
  const [entry] = detectCurrentStateChanges(
    { deviceStatusLedgerUpdatedAt: '2026-07-14T08:00:30.104Z' },
    { deviceStatusLedgerUpdatedAt: '2026-07-14T08:00:00.000Z' }
  );

  assert.equal(entry.category, 'RUNTIME');
});

test('device-data Ledger changes classify as data', () => {
  const [entry] = detectCurrentStateChanges(
    { deviceDataLedgerUpdatedAt: '2026-07-14T08:00:30.105Z' },
    { deviceDataLedgerUpdatedAt: undefined }
  );

  assert.equal(entry.category, 'DATA');
});

test('watch suppresses unchanged current-state snapshots', () => {
  const entries = detectCurrentStateChanges(
    { deviceStatusLedgerUpdatedAt: '2026-07-14T08:00:30.104Z' },
    { deviceStatusLedgerUpdatedAt: '2026-07-14T08:00:30.104Z' }
  );

  assert.deepEqual(entries, []);
});

test('watch JSON mode emits structured line JSON', () => {
  const output = formatWatchEntry({
    time: '2026-07-14T08:00:00.000Z',
    category: 'SERIAL',
    summary: 'boot',
    event: event({ eventName: 'serialLog', serialLogLine: 'boot' }),
  }, watchOptions({ json: true }));

  assert.deepEqual(JSON.parse(output), {
    time: '2026-07-14T08:00:00.000Z',
    category: 'SERIAL',
    summary: 'boot',
    event: event({ eventName: 'serialLog', serialLogLine: 'boot' }),
  });
});

test('watch type filters include and exclude categories', () => {
  const state = createWatchState(watchOptions({ sinceMs: 60000 }), new Date('2026-07-14T08:00:10.000Z'));
  const entries = buildWatchEntries([
    event({ eventTime: '2026-07-14T08:00:01.000Z', eventId: 'serial', s3Key: 'serial', eventName: 'serialLog', serialLogLine: 'boot' }),
    event({ eventTime: '2026-07-14T08:00:02.000Z', eventId: 'telemetry', s3Key: 'telemetry', occupancy: 12 }),
  ], null, state, watchOptions({ sinceMs: 60000, includeTypes: new Set(['SERIAL', 'TELEMETRY']), excludeTypes: new Set(['TELEMETRY']) }));

  assert.deepEqual(entries.map(entry => entry.category), ['SERIAL']);
});

test('watch retries transient API failures and recovers without losing cursor', async () => {
  const output = [];
  const warnings = [];
  const controller = new AbortController();
  let attempts = 0;
  let sleeps = 0;

  await runWatchLoop({}, { deviceId: 'device123' }, watchOptions({ sinceMs: 60000 }), {
    signal: controller.signal,
    now: () => new Date('2026-07-14T08:00:10.000Z'),
    fetchTimeline: async () => {
      attempts += 1;
      if (attempts === 1) throw new TransientWatchError('temporary outage');
      return { events: [event({ eventTime: '2026-07-14T08:00:11.000Z', eventId: 'new', s3Key: 'new' })] };
    },
    loadCurrentState: async () => null,
    write: line => output.push(line),
    warn: message => warnings.push(message),
    sleep: async () => {
      sleeps += 1;
      if (sleeps >= 2) controller.abort();
    },
  });

  assert.equal(attempts, 2);
  assert.equal(output.length, 1);
  assert.equal(warnings.length, 0);
});

test('watch exits cleanly when aborted during sleep', async () => {
  const controller = new AbortController();
  let sleeps = 0;

  await runWatchLoop({}, { deviceId: 'device123' }, watchOptions(), {
    signal: controller.signal,
    now: () => new Date('2026-07-14T08:00:10.000Z'),
    fetchTimeline: async () => ({ events: [] }),
    loadCurrentState: async () => null,
    sleep: async () => {
      sleeps += 1;
      controller.abort();
    },
  });

  assert.equal(sleeps, 1);
});

test('startup banner explains --since for default from-now mode', () => {
  const lines = getWatchBannerLines({ deviceId: 'device123', deviceName: 'P2-NewCode-Dev' }, watchOptions());

  assert.deepEqual(lines.slice(0, 3), [
    'Watching P2-NewCode-Dev (device123) from now',
    'Use --since <duration> to include recent history.',
    'Press Ctrl-C to stop.',
  ]);
  assert.equal(formatDuration(300000), '5m');
});

test('Dynamo fallback paginates across multiple pages', () => {
  const calls = [];
  const context = {
    options: {},
    logEventsTableName: 'events-table',
    awsJson: (_options, args, settings) => {
      calls.push({ args, settings });
      if (calls.length === 1) {
        return {
          Items: [dynamoItem({ eventId: 'newer', s3Key: 'newer', eventTime: '2026-07-14T08:00:02.000Z' })],
          LastEvaluatedKey: { deviceId: { S: 'device123' }, eventTime: { S: '2026-07-14T08:00:02.000Z' } },
        };
      }
      return { Items: [dynamoItem({ eventId: 'older', s3Key: 'older', eventTime: '2026-07-14T08:00:01.000Z' })] };
    },
  };

  const timeline = queryTimelineFromDynamo(context, 'device123', {
    start: '2026-07-14T08:00:00.000Z',
    end: '2026-07-14T08:00:03.000Z',
    limit: 2,
    pageLimit: 1,
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(timeline.events.map(item => item.eventId), ['newer', 'older']);
  assert.equal(calls[0].settings.operation, 'dynamodb query timeline');
  assert.equal(calls[0].settings.tableName, 'events-table');
  assert.equal(calls[0].settings.deviceId, 'device123');
});

test('Dynamo fallback uses bounded page sizes for large result sets', () => {
  const limits = [];
  const context = {
    options: {},
    logEventsTableName: 'events-table',
    awsJson: (_options, args) => {
      limits.push(Number(args[args.indexOf('--limit') + 1]));
      return {
        Items: Array.from({ length: limits[limits.length - 1] }, (_, index) => dynamoItem({ eventId: `event-${limits.length}-${index}`, s3Key: `s3/${limits.length}/${index}` })),
        ...(limits.length < 3 && { LastEvaluatedKey: { deviceId: { S: 'device123' }, eventTime: { S: String(limits.length) } } }),
      };
    },
  };

  const timeline = queryTimelineFromDynamo(context, 'device123', {
    start: '2026-07-14T08:00:00.000Z',
    end: '2026-07-14T08:00:03.000Z',
    limit: 450,
  });

  assert.deepEqual(limits, [200, 200, 50]);
  assert.equal(timeline.events.length, 450);
});

test('Dynamo fallback treats empty quiet polls as valid when allowed', () => {
  const timeline = queryTimelineFromDynamo({
    options: {},
    logEventsTableName: 'events-table',
    awsJson: () => ({ Items: [] }),
  }, 'device123', {
    start: '2026-07-14T08:00:00.000Z',
    end: '2026-07-14T08:00:03.000Z',
    limit: 10,
    allowEmpty: true,
  });

  assert.equal(timeline.count, 0);
  assert.deepEqual(timeline.events, []);
});
