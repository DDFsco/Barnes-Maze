import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countErrors,
  escapeLatency,
  firstTargetVisit,
  pathLength,
  secondsAtFrame,
} from '../src/analysis/metrics.mjs';

describe('Barnes maze metrics', () => {
  it('uses the supplied frame rate for latency conversion', () => {
    assert.equal(secondsAtFrame(300, 30), 10);
    assert.equal(Number(secondsAtFrame(150, 15000 / 1001).toFixed(3)), 10.01);
  });

  it('computes path length only across valid consecutive points', () => {
    const points = [
      { x: 0, y: 0, valid: true },
      { x: 3, y: 4, valid: true },
      { x: 30, y: 40, valid: false },
      { x: 6, y: 8, valid: true },
    ];
    assert.equal(pathLength(points, 2), 2.5);
  });

  it('separates primary and total errors around target visit', () => {
    const events = [
      { type: 'investigation', hole: 3, timeSeconds: 2 },
      { type: 'investigation', hole: 5, timeSeconds: 6 },
      { type: 'investigation', hole: 8, timeSeconds: 9 },
      { type: 'investigation', hole: 4, timeSeconds: 12 },
      { type: 'escape', hole: 5, timeSeconds: 19 },
    ];

    assert.equal(firstTargetVisit(events, 5), 6);
    assert.equal(countErrors(events, 5, 6), 1);
    assert.equal(countErrors(events, 5), 3);
    assert.equal(escapeLatency(events), 19);
  });
});
