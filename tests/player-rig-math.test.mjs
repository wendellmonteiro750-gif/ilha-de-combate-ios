import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDampedVelocity, solveTwoBoneIK } from '../player-rig-math.mjs';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('damped movement approaches its target without overshooting', () => {
  const next = stepDampedVelocity(0, 0, 4, -2, 18, 1 / 60);
  assert.ok(next.x > 0 && next.x < 4);
  assert.ok(next.z < 0 && next.z > -2);
});

test('damped movement brakes smoothly when the stick is released', () => {
  const next = stepDampedVelocity(3, -1, 0, 0, 23, 1 / 60);
  assert.ok(next.x > 0 && next.x < 3);
  assert.ok(next.z < 0 && next.z > -1);
});

test('two-bone IK preserves both limb segment lengths for a reachable target', () => {
  const shoulder = [0, 0, 0];
  const result = solveTwoBoneIK(shoulder, [0.6, 0.1, -0.1], [0, 1, 0], 0.52, 0.48);
  assert.equal(result.reachable, true);
  assert.ok(Math.abs(distance(shoulder, result.elbow) - 0.52) < 1e-6);
  assert.ok(Math.abs(distance(result.elbow, result.hand) - 0.48) < 1e-6);
});

test('two-bone IK clamps an unreachable grip to the arm reach', () => {
  const result = solveTwoBoneIK([0, 0, 0], [4, 0, 0], [0, 1, 0], 0.52, 0.48);
  assert.equal(result.reachable, false);
  assert.ok(Math.abs(result.distance - 0.99999) < 1e-6);
  assert.ok(Math.abs(distance([0, 0, 0], result.hand) - 0.99999) < 1e-6);
});

test('two-bone IK rejects invalid segment lengths', () => {
  assert.throws(() => solveTwoBoneIK([0, 0, 0], [1, 0, 0], [0, 1, 0], 0, 0.4), RangeError);
});
