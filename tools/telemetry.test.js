'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  enrichDeviceNames,
  isDeviceId,
  resolveDeviceSelector,
} = require('./telemetry');

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
