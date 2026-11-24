import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const game = read('../game.js');
const index = read('../index.html');
const worker = read('../service-worker.js');

test('game imports the pure movement and IK module', () => {
  assert.match(game, /stepDampedVelocity, solveTwoBoneIK/);
  assert.match(game, /player-rig-math\.mjs\?v=rig-math-1/);
});

test('combat rig exposes locomotion, two-hand IK and reload states', () => {
  assert.match(game, /function animatePlayerRig\(/);
  assert.match(game, /function solveProceduralArm\(/);
  assert.match(game, /function reload\(/);
  assert.match(game, /reloadProgress/);
  assert.match(game, /ammoByWeapon/);
  assert.doesNotMatch(game, /animateSoldierRig\(dt\)/);
});

test('HTML and service worker use the same versioned game modules', () => {
  assert.match(index, /game\.js\?v=rig-combat-2/);
  assert.match(worker, /operation-nine-v13/);
  assert.match(worker, /game\.js\?v=rig-combat-2/);
  assert.match(worker, /player-rig-math\.mjs\?v=rig-math-1/);
});
