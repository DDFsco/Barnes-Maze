export function secondsAtFrame(frameIndex, fps) {
  if (!Number.isFinite(frameIndex) || frameIndex < 0) {
    throw new Error('frameIndex must be a non-negative number');
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error('fps must be positive');
  }
  return frameIndex / fps;
}

export function pathLength(points, pixelsPerCm) {
  if (!Number.isFinite(pixelsPerCm) || pixelsPerCm <= 0) {
    throw new Error('pixelsPerCm must be positive');
  }
  let totalPixels = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous.valid || !current.valid) continue;
    totalPixels += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return totalPixels / pixelsPerCm;
}

export function speedCmPerSecond(points, pixelsPerCm) {
  const validPoints = points.filter((point) => point.valid);
  if (validPoints.length < 2) return null;
  const durationSeconds =
    validPoints[validPoints.length - 1].timeSeconds - validPoints[0].timeSeconds;
  if (durationSeconds <= 0) return null;
  return pathLength(points, pixelsPerCm) / durationSeconds;
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export function targetQuadrantOccupancy(points, platform, targetPoint) {
  const validPoints = points.filter((point) => point.valid);
  if (validPoints.length === 0) return null;
  const targetAngle = Math.atan2(targetPoint.y - platform.y, targetPoint.x - platform.x);
  const inQuadrant = validPoints.filter((point) => {
    const pointAngle = Math.atan2(point.y - platform.y, point.x - platform.x);
    return Math.abs(angleDelta(pointAngle, targetAngle)) <= Math.PI / 4;
  }).length;
  return (inQuadrant / validPoints.length) * 100;
}

export function countErrors(events, targetHole, untilSeconds = Infinity) {
  return events.filter(
    (event) =>
      event.type === 'investigation' &&
      event.hole !== targetHole &&
      event.timeSeconds <= untilSeconds,
  ).length;
}

export function firstTargetVisit(events, targetHole) {
  const visit = events
    .filter((event) => event.type === 'investigation' && event.hole === targetHole)
    .sort((a, b) => a.timeSeconds - b.timeSeconds)[0];
  return visit?.timeSeconds ?? null;
}

export function escapeLatency(events) {
  const escape = events
    .filter((event) => event.type === 'escape')
    .sort((a, b) => a.timeSeconds - b.timeSeconds)[0];
  return escape?.timeSeconds ?? null;
}

export function classifyStrategy(events, targetHole, wellCount, primaryErrors, quadrantPercent = null) {
  if (events.length === 0) return null;
  const firstTarget = events.find((event) => event.hole === targetHole);
  const investigationHoles = events
    .filter((event) => event.type === 'investigation')
    .map((event) => event.hole);
  const adjacentSteps = investigationHoles.slice(1).filter((hole, index) => {
    const previous = investigationHoles[index];
    return (
      hole === (previous % wellCount) + 1 ||
      hole === ((previous + wellCount - 2) % wellCount) + 1
    );
  }).length;
  const serialScore =
    investigationHoles.length > 1 ? adjacentSteps / (investigationHoles.length - 1) : 0;

  if (firstTarget && primaryErrors <= 2 && (quadrantPercent === null || quadrantPercent >= 35)) {
    return 'spatial';
  }
  if (investigationHoles.length >= 3 && serialScore >= 0.65) {
    return 'serial';
  }
  return 'random';
}
