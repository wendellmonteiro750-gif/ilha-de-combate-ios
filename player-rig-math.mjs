// Small, browser-safe math helpers for the player controller. Kept pure so the
// movement and two-bone arm solver can be regression-tested without WebGL.
export function stepDampedVelocity(vx, vz, targetX, targetZ, acceleration, dt) {
  const alpha = 1 - Math.exp(-Math.max(0, acceleration) * Math.max(0, dt));
  return {
    x: vx + (targetX - vx) * alpha,
    z: vz + (targetZ - vz) * alpha,
  };
}

export function solveTwoBoneIK(shoulder, target, pole, upperLength, lowerLength) {
  const finite3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  if (!finite3(shoulder) || !finite3(target) || !finite3(pole)) {
    throw new TypeError('IK points must be finite [x, y, z] arrays');
  }
  if (!Number.isFinite(upperLength) || !Number.isFinite(lowerLength) || !(upperLength > 0) || !(lowerLength > 0)) {
    throw new RangeError('IK segment lengths must be positive');
  }

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const addScaled = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const length = (a) => Math.hypot(a[0], a[1], a[2]);
  const normalize = (a, fallback) => {
    const n = length(a);
    return n > 1e-8 ? a.map((v) => v / n) : fallback.slice();
  };

  const delta = sub(target, shoulder);
  const rawDistance = length(delta);
  const minReach = Math.abs(upperLength - lowerLength) + 1e-5;
  const maxReach = upperLength + lowerLength - 1e-5;
  const distance = Math.min(maxReach, Math.max(minReach, rawDistance));
  const direction = normalize(delta, [0, 0, -1]);

  let bend = sub(pole, [0, 0, 0]);
  bend = sub(bend, direction.map((v) => v * dot(bend, direction)));
  if (length(bend) < 1e-6) {
    const fallback = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    bend = [
      direction[1] * fallback[2] - direction[2] * fallback[1],
      direction[2] * fallback[0] - direction[0] * fallback[2],
      direction[0] * fallback[1] - direction[1] * fallback[0],
    ];
  }
  bend = normalize(bend, [1, 0, 0]);

  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const elbow = addScaled(addScaled(shoulder, direction, along), bend, height);
  const hand = addScaled(shoulder, direction, distance);

  return {
    elbow,
    hand,
    distance,
    reachable: rawDistance >= minReach && rawDistance <= maxReach,
  };
}
