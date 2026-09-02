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
