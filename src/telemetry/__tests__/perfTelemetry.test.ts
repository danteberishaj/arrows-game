import { readFileSync } from 'node:fs';
import { join } from 'node:path';

afterEach(() => {
  delete process.env.EXPO_PUBLIC_PERF_LEVEL;
});

test('App configures PERF builds as disabled and the real aggregator emits nothing', () => {
  const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
  expect(appSource).toContain('Telemetry.configure({ disabled: PERF_MODE });');
  expect(appSource).toContain('PERF_MODE || RemoteConfig.telemetryKilled()');

  process.env.EXPO_PUBLIC_PERF_LEVEL = '3827';
  jest.isolateModules(() => {
    const { PERF_MODE } = require('../../perfMode') as typeof import('../../perfMode');
    const telemetry = require('../telemetry') as typeof import('../telemetry');
    const { LevelAggregator } = require('../levelAggregator') as typeof import('../levelAggregator');
    const sink = telemetry.createMemorySink(20);
    telemetry.Telemetry.useSink(sink);
    telemetry.Telemetry.configure({ validate: true, disabled: PERF_MODE });

    const aggregator = new LevelAggregator(1_000);
    aggregator.start(3827, 250, 'Circle', 3, 'campaign', 1_100);
    aggregator.tap('exit');
    aggregator.end('abandoned', 3, 1_200);
    aggregator.sessionEnd(1_300);
    telemetry.Telemetry.emit('screen_view', { screen: 'game' });

    expect(PERF_MODE).toBe(true);
    expect(sink.events).toHaveLength(0);
  });
});
