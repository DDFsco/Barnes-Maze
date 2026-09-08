import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crosshair,
  Download,
  FileJson,
  FolderOpen,
  Info,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Save,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createXlsxWorkbook, type WorkbookSheet } from '../lib/xlsx';

type Point = { x: number; y: number };
type Platform = Point & { r: number };
type Well = Point & { id: number; radius: number };
type SettingsSnapshot = {
  targetHole: number;
  selectedWellId: number;
  dwell: number;
  distance: number;
  platformDiameterCm: number;
  platform: Platform;
  holes: Well[];
  holeScale: number;
  rotationDegrees: number;
  smoothingWindow: number;
  maxGapFrames: number;
  outlierDistancePx: number;
};
type SettingsPreset = {
  id: number;
  settings: SettingsSnapshot | null;
};
type ToolMode =
  | 'select'
  | 'add-nodes'
  | 'move-maze'
  | 'move-hole'
  | 'target'
  | 'investigation'
  | 'escape';
type ObjectPanelTab = 'mice' | 'wells' | 'events' | 'flagged';
type SearchStrategy = 'spatial' | 'serial' | 'random';
type DragTarget =
  | { type: 'platform'; start: Point; origin: Platform }
  | { type: 'hole'; id: number }
  | { type: 'body'; skeletonId: number }
  | { type: 'nose'; skeletonId: number };

type Skeleton = {
  id: number;
  label: string;
  body: Point;
  nose: Point;
};

type AnnotationEvent = {
  type: 'investigation' | 'escape';
  frame: number;
  hole: number;
  source: 'manual';
};

type EventLogEntry = {
  id: string;
  type: 'investigation' | 'escape';
  source: 'manual' | 'auto';
  hole: number;
  startFrame: number;
  endFrame: number;
  timeSeconds: number;
  durationSeconds: number;
  confidence: number;
  detectionConfidence: number;
  terminal: boolean;
};

type TrajectoryPoint = Point & {
  frame: number;
  timeSeconds: number;
  valid: boolean;
};

type FrameAnnotation = {
  skeletons: Skeleton[];
  selectedSkeletonId: number;
  events: AnnotationEvent[];
  touched: boolean;
  detectionConfidence?: number;
};

type AnnotationStore = Record<string, Record<string, FrameAnnotation>>;

type FrameAnalysis = {
  status: 'idle' | 'ready' | 'error';
  message: string;
  confidence: number;
  source: 'video' | 'sample';
  darkPixels: number;
  componentPixels: number;
  body?: Point;
  nose?: Point;
};

type BackgroundModel = {
  width: number;
  height: number;
  luminance: Float32Array;
};

type TrackingRun = {
  status: 'idle' | 'running' | 'done' | 'error';
  processed: number;
  total: number;
  saved: number;
  message: string;
};

type ReviewFlag = {
  frame: number;
  reason: 'low-confidence' | 'no-detection';
  confidence: number;
  reviewed: boolean;
};

type ReviewGroup = {
  startFrame: number;
  endFrame: number;
  reason: ReviewFlag['reason'];
  confidence: number;
  flags: ReviewFlag[];
};

type LayerVisibility = {
  maze: boolean;
  wells: boolean;
  skeletons: boolean;
  trajectory: boolean;
  events: boolean;
};

type SampleVideo = {
  id: string;
  label: string;
  fileName: string;
  frame: string;
  frames: number;
  fpsValue: number;
  fpsLabel: string;
  durationSeconds: number;
  platform: Platform;
  mouse: Point;
  targetHole: number;
  trackedPct: number;
  failureFrames: number;
  primaryLatency: number;
  totalLatency: number;
  primaryErrors: number;
  totalErrors: number;
  pathCm: number;
  speedCms: number;
  targetQuadrantPct: number;
  strategy: 'spatial' | 'serial' | 'random';
  caveat: string;
};

type UploadedVideo = {
  id: string;
  name: string;
  url: string;
  durationSeconds: number;
  width: number;
  height: number;
};

type SessionResult = {
  videoId: string;
  video: string;
  status: 'complete' | 'partial';
  durationSeconds: number;
  fps: number;
  frameCount: number;
  framesProcessed: number;
  framesSaved: number;
  flagsOpen: number;
  primaryLatency: number | null;
  totalLatency: number | null;
  primaryErrors: number | null;
  totalErrors: number | null;
  events: number;
  pathCm: number | null;
  speedCms: number | null;
  targetQuadrantPct: number | null;
  strategy: SearchStrategy | null;
  dwellThresholdSeconds: number;
  noseProxyDistanceCm: number;
  platformDiameterCm: number;
  wellCount: number;
  analysisVersion: string;
  smoothingWindow: number;
  maxGapFrames: number;
  outlierDistancePx: number;
};

type ReviewFlagsByVideo = Record<string, ReviewFlag[]>;

const samples: SampleVideo[] = [
  {
    id: 'test50',
    label: 'Trial test50',
    fileName: 'test50.mp4',
    frame: '/sample-frames/test50.jpg',
    frames: 5539,
    fpsValue: 30,
    fpsLabel: '30 fps',
    durationSeconds: 185.07,
    platform: { x: 323, y: 239, r: 201 },
    mouse: { x: 332, y: 422 },
    targetHole: 6,
    trackedPct: 92.4,
    failureFrames: 421,
    primaryLatency: 34.8,
    totalLatency: 177.3,
    primaryErrors: 4,
    totalErrors: 17,
    pathCm: 683.5,
    speedCms: 3.9,
    targetQuadrantPct: 38.5,
    strategy: 'serial',
    caveat: 'Animal partly merges with the lower rim and adjacent hole.',
  },
  {
    id: 'test51',
    label: 'Trial test51',
    fileName: 'test51.mp4',
    frame: '/sample-frames/test51.jpg',
    frames: 741,
    fpsValue: 15000 / 1001,
    fpsLabel: '15000/1001 fps',
    durationSeconds: 49.38,
    platform: { x: 283, y: 242, r: 217 },
    mouse: { x: 140, y: 113 },
    targetHole: 10,
    trackedPct: 86.1,
    failureFrames: 103,
    primaryLatency: 11.6,
    totalLatency: 42.1,
    primaryErrors: 2,
    totalErrors: 6,
    pathCm: 192.4,
    speedCms: 4.3,
    targetQuadrantPct: 21.7,
    strategy: 'spatial',
    caveat: 'Platform is shifted left; dark wall hardware can mimic animal pixels.',
  },
  {
    id: 'test53',
    label: 'Trial test53',
    fileName: 'test53.mp4',
    frame: '/sample-frames/test53.jpg',
    frames: 905,
    fpsValue: 30,
    fpsLabel: '30 fps',
    durationSeconds: 30.23,
    platform: { x: 322, y: 239, r: 201 },
    mouse: { x: 486, y: 322 },
    targetHole: 4,
    trackedPct: 89.8,
    failureFrames: 92,
    primaryLatency: 18.2,
    totalLatency: 27.9,
    primaryErrors: 5,
    totalErrors: 7,
    pathCm: 148.9,
    speedCms: 5.2,
    targetQuadrantPct: 18.9,
    strategy: 'random',
    caveat: 'Animal is close to a side hole; nose proxy needs review.',
  },
];

const toolModes: Array<{ id: ToolMode; label: string }> = [
  { id: 'select', label: 'Nose / Body' },
  { id: 'add-nodes', label: 'Add nodes' },
  { id: 'move-maze', label: 'Maze' },
  { id: 'move-hole', label: 'Well' },
  { id: 'target', label: 'Target' },
  { id: 'investigation', label: 'Visit' },
  { id: 'escape', label: 'Escape' },
];

const statuses = [
  { name: 'Video', value: 'loaded', tone: 'good' },
  { name: 'Maze', value: 'editable', tone: 'good' },
  { name: 'Tracking', value: 'review', tone: 'warn' },
  { name: 'Events', value: 'draft', tone: 'warn' },
  { name: 'Export', value: 'ready', tone: 'good' },
];

const annotationStorageKey = 'barnesai.frameAnnotations.v1';
const settingsPresetStorageKey = 'barnesai.settingsPresets.v1';
const emptySettingsPresets: SettingsPreset[] = [
  { id: 1, settings: null },
  { id: 2, settings: null },
  { id: 3, settings: null },
];

const initialAnalysis: FrameAnalysis = {
  status: 'idle',
  message: 'No frame analyzed yet',
  confidence: 0,
  source: 'sample',
  darkPixels: 0,
  componentPixels: 0,
};

const initialTrackingRun: TrackingRun = {
  status: 'idle',
  processed: 0,
  total: 0,
  saved: 0,
  message: 'No tracking pass run yet',
};

function formatSeconds(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.round(safeValue % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function csvEscape(value: string | number | null) {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildWellPoints(platform: Platform, scale: number, rotationDegrees = 0, count = 20): Well[] {
  return Array.from({ length: count }, (_, index) => {
    const angle =
      -Math.PI / 2 + (rotationDegrees * Math.PI) / 180 + (index / count) * Math.PI * 2;
    const r = platform.r * scale;
    return {
      id: index + 1,
      x: platform.x + Math.cos(angle) * r,
      y: platform.y + Math.sin(angle) * r,
      radius: 10,
    };
  });
}

function buildHolePoints(platform: Platform, scale: number, rotationDegrees = 0) {
  return buildWellPoints(platform, scale, rotationDegrees, 20);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function angleDelta(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function nearestWell(point: Point, wells: Well[]) {
  return wells.reduce<{ well: Well | null; distance: number }>(
    (nearest, well) => {
      const distance = Math.hypot(well.x - point.x, well.y - point.y);
      return distance < nearest.distance ? { well, distance } : nearest;
    },
    { well: null, distance: Infinity },
  );
}

function detectEventLog(
  annotations: Record<string, FrameAnnotation>,
  wells: Well[],
  targetWell: number,
  dwellSeconds: number,
  fps: number,
  reviewFlags: ReviewFlag[] = [],
): EventLogEntry[] {
  const autoEvents: EventLogEntry[] = [];
  const manualEvents: EventLogEntry[] = [];
  const minFrames = Math.max(1, Math.ceil(dwellSeconds * fps));
  const sortedFrames = Object.entries(annotations)
    .map(([frame, annotation]) => ({ frame: Number(frame), annotation }))
    .filter(({ frame }) => Number.isFinite(frame))
    .sort((a, b) => a.frame - b.frame);

  let active:
    | {
        hole: number;
        startFrame: number;
        endFrame: number;
        confidenceSum: number;
        detectionConfidenceSum: number;
        count: number;
      }
    | null = null;
  let terminalReached = false;

  function closeActive() {
    if (!active) return;
    const durationFrames = active.endFrame - active.startFrame + 1;
    if (durationFrames >= minFrames) {
      autoEvents.push({
        id: `auto-${active.hole}-${active.startFrame + 1}-${active.endFrame + 1}`,
        type: 'investigation',
        source: 'auto',
        hole: active.hole,
        startFrame: active.startFrame,
        endFrame: active.endFrame,
        timeSeconds: active.startFrame / fps,
        durationSeconds: durationFrames / fps,
        confidence: active.confidenceSum / Math.max(1, active.count),
        detectionConfidence: active.detectionConfidenceSum / Math.max(1, active.count),
        terminal: false,
      });
    }
    active = null;
  }

  for (const { frame, annotation } of sortedFrames) {
    if (terminalReached) break;
    for (const event of annotation.events) {
      manualEvents.push({
        id: `manual-${event.type}-${event.hole}-${event.frame + 1}`,
        type: event.type,
        source: 'manual',
        hole: event.hole,
        startFrame: event.frame,
        endFrame: event.frame,
        timeSeconds: event.frame / fps,
        durationSeconds: 0,
        confidence: 1,
        detectionConfidence: 1,
        terminal: event.type === 'escape',
      });
      if (event.type === 'escape') terminalReached = true;
    }

    if (terminalReached) break;

    const skeleton = annotation.skeletons.find(
      (candidate) => candidate.id === annotation.selectedSkeletonId,
    ) ?? annotation.skeletons[0];
    if (!skeleton || wells.length === 0) {
      closeActive();
      continue;
    }

    const nearest = nearestWell(skeleton.nose, wells);
    const hitWell = nearest.well && nearest.distance <= Math.max(10, nearest.well.radius + 8)
      ? nearest.well
      : null;
    if (!hitWell) {
      closeActive();
      continue;
    }

    const confidence = clamp(1 - nearest.distance / Math.max(1, hitWell.radius + 8), 0.1, 1);
    const detectionConfidence = annotation.detectionConfidence ?? 1;
    if (active !== null && active.hole === hitWell.id && frame <= active.endFrame + 1) {
      active.endFrame = frame;
      active.confidenceSum += confidence;
      active.detectionConfidenceSum += detectionConfidence;
      active.count += 1;
      continue;
    }

    closeActive();
    if (terminalReached) break;
    active = {
      hole: hitWell.id,
      startFrame: frame,
      endFrame: frame,
      confidenceSum: confidence,
      detectionConfidenceSum: detectionConfidence,
      count: 1,
    };
  }

  closeActive();

  // Imported projects can contain historical duplicate clicks. Keep the event
  // log valid even before those annotations are edited again in the UI.
  const uniqueManualEvents = Array.from(
    new Map(
      manualEvents.map((event) => [
        `${event.type}:${event.hole}:${event.startFrame}`,
        event,
      ]),
    ).values(),
  );
  const manualEscape = uniqueManualEvents
    .filter((event) => event.type === 'escape')
    .sort(
      (a, b) =>
        a.startFrame - b.startFrame ||
        Number(b.hole === targetWell) - Number(a.hole === targetWell) ||
        a.hole - b.hole,
    )[0];
  const normalizedManualEvents = manualEscape
    ? uniqueManualEvents.filter(
        (event) =>
          event.startFrame < manualEscape.startFrame ||
          (event.type === 'escape' && event.id === manualEscape.id),
      )
    : uniqueManualEvents;
  const hasManualEscape = Boolean(manualEscape);
  if (!hasManualEscape) {
    const missingFrames = new Set(
      reviewFlags
        // An open no-detection flag is evidence for a possible escape. Once a
        // reviewer clears it, do not retain an automatic escape claim.
        .filter((flag) => flag.reason === 'no-detection' && !flag.reviewed)
        .map((flag) => flag.frame),
    );
    const requiredMissingFrames = Math.max(3, Math.ceil(fps * 0.25));
    const targetInvestigations = autoEvents.filter(
      (event) => event.type === 'investigation' && event.hole === targetWell,
    );
    const targetEvent = targetInvestigations[targetInvestigations.length - 1];
    if (targetEvent) {
      let consecutiveMissing = 0;
      for (let frame = targetEvent.endFrame + 1; missingFrames.has(frame); frame += 1) {
        consecutiveMissing += 1;
      }
      if (consecutiveMissing >= requiredMissingFrames) {
        autoEvents.push({
          id: `auto-escape-${targetEvent.endFrame + 1}`,
          type: 'escape',
          source: 'auto',
          hole: targetWell,
          startFrame: targetEvent.endFrame,
          endFrame: targetEvent.endFrame + consecutiveMissing,
          timeSeconds: targetEvent.endFrame / fps,
          durationSeconds: consecutiveMissing / fps,
          confidence: clamp(targetEvent.confidence * 0.72, 0.2, 0.78),
          detectionConfidence: 0,
          terminal: true,
        });
      }
    }
  }
  return [...normalizedManualEvents, ...autoEvents].sort(
    (a, b) => a.timeSeconds - b.timeSeconds || Number(b.terminal) - Number(a.terminal),
  );
}

function buildTrajectory(
  annotations: Record<string, FrameAnnotation>,
  fps: number,
): TrajectoryPoint[] {
  return Object.entries(annotations)
    .map(([frame, annotation]) => {
      const frameNumber = Number(frame);
      const skeleton =
        annotation.skeletons.find((candidate) => candidate.id === annotation.selectedSkeletonId) ??
        annotation.skeletons[0];
      return {
        frame: frameNumber,
        timeSeconds: frameNumber / fps,
        x: skeleton?.body.x ?? 0,
        y: skeleton?.body.y ?? 0,
        valid: Number.isFinite(frameNumber) && Boolean(skeleton),
      };
    })
    .filter((point) => Number.isFinite(point.frame))
    .sort((a, b) => a.frame - b.frame);
}

function processTrajectory(
  points: TrajectoryPoint[],
  smoothingWindow: number,
  maxGapFrames: number,
  outlierDistancePx: number,
) {
  const result: TrajectoryPoint[] = [];
  let previous: TrajectoryPoint | null = null;
  for (const point of points) {
    if (!point.valid) {
      result.push(point);
      previous = null;
      continue;
    }
    if (previous) {
      const frameGap = point.frame - previous.frame;
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      if (distance > outlierDistancePx) {
        result.push({ ...point, valid: false });
        previous = null;
        continue;
      }
      if (frameGap > 1 && frameGap <= maxGapFrames + 1) {
        for (let frame = previous.frame + 1; frame < point.frame; frame += 1) {
          const ratio = (frame - previous.frame) / frameGap;
          result.push({
            frame,
            timeSeconds: previous.timeSeconds + (point.timeSeconds - previous.timeSeconds) * ratio,
            x: previous.x + (point.x - previous.x) * ratio,
            y: previous.y + (point.y - previous.y) * ratio,
            valid: true,
          });
        }
      } else if (frameGap > maxGapFrames + 1) {
        result.push({ ...previous, frame: previous.frame + 0.5, valid: false });
      }
    }
    result.push(point);
    previous = point;
  }
  if (smoothingWindow === 0) return result;
  return result.map((point, index) => {
    if (!point.valid) return point;
    const nearby = result.slice(Math.max(0, index - smoothingWindow), index + smoothingWindow + 1)
      .filter((candidate) => candidate.valid && Math.abs(candidate.frame - point.frame) <= smoothingWindow);
    if (nearby.length < 2) return point;
    return {
      ...point,
      x: nearby.reduce((sum, candidate) => sum + candidate.x, 0) / nearby.length,
      y: nearby.reduce((sum, candidate) => sum + candidate.y, 0) / nearby.length,
    };
  });
}

function groupReviewFlags(flags: ReviewFlag[]): ReviewGroup[] {
  const groups: ReviewGroup[] = [];
  for (const flag of [...flags].sort((a, b) => a.frame - b.frame)) {
    const previous = groups[groups.length - 1];
    if (previous && previous.reason === flag.reason && flag.frame <= previous.endFrame + 1) {
      previous.endFrame = flag.frame;
      previous.confidence = Math.min(previous.confidence, flag.confidence);
      previous.flags.push(flag);
      continue;
    }
    groups.push({
      startFrame: flag.frame,
      endFrame: flag.frame,
      reason: flag.reason,
      confidence: flag.confidence,
      flags: [flag],
    });
  }
  return groups;
}

function pathLengthCm(points: TrajectoryPoint[], pixelsPerCm: number) {
  if (points.length < 2 || pixelsPerCm <= 0) return null;
  let totalPixels = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous.valid || !current.valid) continue;
    totalPixels += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return totalPixels > 0 ? totalPixels / pixelsPerCm : null;
}

function targetQuadrantPercent(points: TrajectoryPoint[], platform: Platform, targetWell: Well | null) {
  const validPoints = points.filter((point) => point.valid);
  if (validPoints.length === 0 || !targetWell) return null;
  const targetAngle = Math.atan2(targetWell.y - platform.y, targetWell.x - platform.x);
  const inQuadrant = validPoints.filter((point) => {
    const pointAngle = Math.atan2(point.y - platform.y, point.x - platform.x);
    return Math.abs(angleDelta(pointAngle, targetAngle)) <= Math.PI / 4;
  }).length;
  return (inQuadrant / validPoints.length) * 100;
}

function classifySearchStrategy(
  events: EventLogEntry[],
  targetWell: number,
  wellCount: number,
  primaryErrors: number,
  quadrantPercent: number | null,
): { label: SearchStrategy | null; reason: string } {
  if (events.length === 0) {
    return { label: null, reason: 'No visit or escape events have been detected yet.' };
  }

  const firstTargetTime = events.find((event) => event.hole === targetWell)?.timeSeconds ?? null;
  const investigationHoles = events
    .filter((event) => event.type === 'investigation')
    .map((event) => event.hole);
  const enoughSerialEvidence = investigationHoles.length >= 3 && wellCount > 2;
  const serialSteps = investigationHoles.slice(1).filter((hole, index) => {
    const previous = investigationHoles[index];
    const clockwise = (previous % wellCount) + 1;
    const counterClockwise = ((previous + wellCount - 2) % wellCount) + 1;
    return hole === clockwise || hole === counterClockwise;
  }).length;
  const serialScore =
    investigationHoles.length > 1 ? serialSteps / Math.max(1, investigationHoles.length - 1) : 0;

  if (
    firstTargetTime !== null &&
    primaryErrors <= 2 &&
    (quadrantPercent === null || quadrantPercent >= 35)
  ) {
    return {
      label: 'spatial',
      reason:
        'The animal reaches the target with few non-target investigations, consistent with direct spatial search.',
    };
  }

  if (enoughSerialEvidence && serialScore >= 0.65) {
    return {
      label: 'serial',
      reason:
        'Most non-target investigations progress through adjacent wells, consistent with ring-following search.',
    };
  }

  return {
    label: 'random',
    reason:
      'The visit order is not strongly direct or adjacent-well serial, so the draft classification is random.',
  };
}

function makeSkeleton(id: number, body: Point): Skeleton {
  return {
    id,
    label: `Animal ${id}`,
    body,
    nose: { x: body.x + 18, y: body.y - 14 },
  };
}

function displayAnimalLabel(label: string) {
  return label.replace(/^mouse\b/i, 'Animal');
}

function makeFrameAnnotation(body: Point): FrameAnnotation {
  return {
    skeletons: [makeSkeleton(1, body)],
    selectedSkeletonId: 1,
    events: [],
    touched: false,
  };
}

function makeEmptyFrameAnnotation(): FrameAnnotation {
  return {
    skeletons: [],
    selectedSkeletonId: 0,
    events: [],
    touched: false,
  };
}

function parseCsvValue(value: string) {
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ? Number(value) : value;
}

function parseCsv(csv: string) {
  const rows: Array<Array<string | number>> = [[]];
  let value = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === ',' && !quoted) {
      rows[rows.length - 1].push(parseCsvValue(value));
      value = '';
      continue;
    }
    if (character === '\n' && !quoted) {
      rows[rows.length - 1].push(parseCsvValue(value));
      rows.push([]);
      value = '';
      continue;
    }
    if (character !== '\r') value += character;
  }
  rows[rows.length - 1].push(parseCsvValue(value));
  return rows.filter((row) => row.length > 1 || row[0] !== '');
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const uploadedVideosRef = useRef<UploadedVideo[]>([]);
  const frameImageRef = useRef<HTMLImageElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopTrackingRef = useRef(false);
  const expectedSeekFrameRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState(samples[0].id);
  const [targetHole, setTargetHole] = useState(samples[0].targetHole);
  const [dwell, setDwell] = useState(0.5);
  const [distance, setDistance] = useState(1.8);
  const [platformDiameterCm, setPlatformDiameterCm] = useState(91);
  const [strategyOverride, setStrategyOverride] = useState<'auto' | SearchStrategy>('auto');
  const [corrections, setCorrections] = useState(0);
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
  const [activeUploadedVideoId, setActiveUploadedVideoId] = useState<string | null>(null);
  const [sessionResults, setSessionResults] = useState<Record<string, SessionResult>>({});
  const [workspaceSettingsByVideo, setWorkspaceSettingsByVideo] = useState<Record<string, SettingsSnapshot>>({});
  const [trackingRunsByVideo, setTrackingRunsByVideo] = useState<Record<string, TrackingRun>>({});
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const [isHeaderDropTarget, setIsHeaderDropTarget] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(samples[0].fpsValue);
  const [platform, setPlatform] = useState(samples[0].platform);
  const [holes, setHoles] = useState(() => buildHolePoints(samples[0].platform, 0.92));
  const [selectedWellId, setSelectedWellId] = useState(samples[0].targetHole);
  const [holeScale, setHoleScale] = useState(0.92);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [smoothingWindow, setSmoothingWindow] = useState(0);
  const [maxGapFrames, setMaxGapFrames] = useState(0);
  const [outlierDistancePx, setOutlierDistancePx] = useState(90);
  const [annotationStore, setAnnotationStore] = useState<AnnotationStore>({});
  const [hasLoadedLocalAnnotations, setHasLoadedLocalAnnotations] = useState(false);
  const [layers, setLayers] = useState<LayerVisibility>({
    maze: true,
    wells: true,
    skeletons: true,
    trajectory: true,
    events: true,
  });
  const [frameAnalysis, setFrameAnalysis] = useState<FrameAnalysis>(initialAnalysis);
  const [trackingRun, setTrackingRun] = useState<TrackingRun>(initialTrackingRun);
  const [reviewFlagsByVideo, setReviewFlagsByVideo] = useState<ReviewFlagsByVideo>({});
  const [settingsPresets, setSettingsPresets] = useState<SettingsPreset[]>(emptySettingsPresets);
  const [activeSettingsPresetId, setActiveSettingsPresetId] = useState<number | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [objectPanelTab, setObjectPanelTab] = useState<ObjectPanelTab>('mice');
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);

  const uploadedVideo =
    uploadedVideos.find((video) => video.id === activeUploadedVideoId) ?? null;
  const selected = samples.find((sample) => sample.id === selectedId) ?? samples[0];
  const activeDuration = uploadedVideo?.durationSeconds || selected.durationSeconds;
  const activeLabel = uploadedVideo?.name ?? selected.fileName;
  const activeVideoKey = uploadedVideo ? `local:${uploadedVideo.id}` : selected.id;
  const totalFrames = uploadedVideo
    ? Math.max(1, Math.round(activeDuration * fps))
    : selected.frames;
  const frameCountSource = uploadedVideo ? 'duration-fps-estimate' : 'sample-metadata';
  const currentFrame = clamp(currentFrameIndex, 0, totalFrames - 1);
  const frameKey = String(currentFrame);
  const frameAnnotation =
    annotationStore[activeVideoKey]?.[frameKey] ??
    (uploadedVideo ? makeEmptyFrameAnnotation() : makeFrameAnnotation(selected.mouse));
  const skeletons = frameAnnotation.skeletons;
  const selectedSkeletonId = frameAnnotation.selectedSkeletonId;
  const events = frameAnnotation.events;
  const selectedWell = holes.find((hole) => hole.id === selectedWellId) ?? holes[0] ?? null;
  const allWellRadius =
    holes.length > 0
      ? Math.round(holes.reduce((sum, hole) => sum + hole.radius, 0) / holes.length)
      : 10;
  const selectedSkeleton =
    skeletons.find((skeleton) => skeleton.id === selectedSkeletonId) ?? skeletons[0];
  const savedFrameCount = Object.values(annotationStore[activeVideoKey] ?? {}).filter(
    (annotation) => annotation.touched,
  ).length;
  const trackingPercent =
    trackingRun.total > 0 ? clamp((trackingRun.processed / trackingRun.total) * 100, 0, 100) : 0;
  const reviewFlags = useMemo(
    () => reviewFlagsByVideo[activeVideoKey] ?? [],
    [activeVideoKey, reviewFlagsByVideo],
  );
  const openReviewFlags = reviewFlags.filter((flag) => !flag.reviewed);
  const reviewGroups = useMemo(() => groupReviewFlags(reviewFlags), [reviewFlags]);
  const openReviewGroups = useMemo(() => groupReviewFlags(openReviewFlags), [openReviewFlags]);
  const currentReviewGroup = openReviewGroups.find(
    (group) => currentFrame >= group.startFrame && currentFrame <= group.endFrame,
  );
  const frameAnnotations = useMemo(
    () => annotationStore[activeVideoKey] ?? {},
    [activeVideoKey, annotationStore],
  );
  const eventLog = useMemo(
    () => detectEventLog(frameAnnotations, holes, targetHole, dwell, fps, reviewFlags),
    [dwell, fps, frameAnnotations, holes, reviewFlags, targetHole],
  );
  const trajectory = useMemo(
    () => buildTrajectory(frameAnnotations, fps),
    [fps, frameAnnotations],
  );
  const processedTrajectory = useMemo(
    () => processTrajectory(trajectory, smoothingWindow, maxGapFrames, outlierDistancePx),
    [maxGapFrames, outlierDistancePx, smoothingWindow, trajectory],
  );
  const validTrajectory = processedTrajectory.filter((point) => point.valid);
  const trajectoryPaths = useMemo(() => {
    const paths: string[] = [];
    let segment: string[] = [];
    for (const point of processedTrajectory) {
      if (!point.valid || point.frame > currentFrame) {
        if (segment.length > 1) paths.push(segment.join(' '));
        segment = [];
        continue;
      }
      segment.push(`${point.x},${point.y}`);
    }
    if (segment.length > 1) paths.push(segment.join(' '));
    return paths;
  }, [currentFrame, processedTrajectory]);
  const occupancyCells = useMemo(() => {
    const columns = 12;
    const rows = 9;
    const counts = new Map<string, number>();
    validTrajectory.forEach((point) => {
      const column = clamp(Math.floor((point.x / 640) * columns), 0, columns - 1);
      const row = clamp(Math.floor((point.y / 480) * rows), 0, rows - 1);
      const key = `${column}:${row}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const maxCount = Math.max(1, ...counts.values());
    return Array.from(counts, ([key, count]) => {
      const [column, row] = key.split(':').map(Number);
      return { column, row, opacity: 0.18 + (count / maxCount) * 0.82 };
    });
  }, [validTrajectory]);
  const activeEventPins = eventLog.filter(
    (event) => currentFrame >= event.startFrame && currentFrame <= event.endFrame,
  );
  const firstTargetEvent = eventLog.find((event) => event.hole === targetHole);
  const firstEscapeEvent = eventLog.find((event) => event.type === 'escape');
  const hasDerivedResults = eventLog.length > 0;
  const hasTrackingSummary = trackingRun.total > 0;
  const primaryErrors = eventLog.filter(
    (event) =>
      event.type === 'investigation' &&
      event.hole !== targetHole &&
      event.timeSeconds <= (firstTargetEvent?.timeSeconds ?? Infinity),
  ).length;
  const totalErrors = eventLog.filter(
    (event) => event.type === 'investigation' && event.hole !== targetHole,
  ).length;
  const derivedPrimaryLatency = firstTargetEvent?.timeSeconds ?? null;
  const derivedTotalLatency = firstEscapeEvent?.timeSeconds ?? null;
  const adjustedErrors = Math.max(
    0,
    hasDerivedResults ? totalErrors : 0,
  );
  const pixelsPerCm = platformDiameterCm > 0 ? (platform.r * 2) / platformDiameterCm : 0;
  const derivedPathCm = pathLengthCm(processedTrajectory, pixelsPerCm);
  const trajectoryDurationSeconds =
    validTrajectory.length >= 2
      ? (validTrajectory[validTrajectory.length - 1].frame - validTrajectory[0].frame) / fps
      : null;
  const derivedSpeedCms =
    derivedPathCm !== null && trajectoryDurationSeconds !== null && trajectoryDurationSeconds > 0
      ? derivedPathCm / trajectoryDurationSeconds
      : null;
  const targetWell = holes.find((hole) => hole.id === targetHole) ?? null;
  const derivedTargetQuadrantPct = targetQuadrantPercent(processedTrajectory, platform, targetWell);
  const autoStrategy = classifySearchStrategy(
    eventLog,
    targetHole,
    holes.length,
    primaryErrors,
    derivedTargetQuadrantPct,
  );
  const finalStrategy = strategyOverride === 'auto' ? autoStrategy.label : strategyOverride;
  const sessionResultsWithCurrentSettings = useMemo(() => {
    const result = sessionResults[activeVideoKey];
    if (!result) return sessionResults;
    return {
      ...sessionResults,
      [activeVideoKey]: {
        ...result,
        pathCm: derivedPathCm,
        speedCms: derivedSpeedCms,
        targetQuadrantPct: derivedTargetQuadrantPct,
        flagsOpen: openReviewFlags.length,
        primaryLatency: derivedPrimaryLatency,
        totalLatency: derivedTotalLatency,
        primaryErrors: hasDerivedResults ? primaryErrors : null,
        totalErrors: hasDerivedResults ? adjustedErrors : null,
        events: eventLog.length,
        strategy: finalStrategy,
        smoothingWindow,
        maxGapFrames,
        outlierDistancePx,
      },
    };
  }, [
    activeVideoKey,
    adjustedErrors,
    derivedPathCm,
    derivedPrimaryLatency,
    derivedSpeedCms,
    derivedTotalLatency,
    derivedTargetQuadrantPct,
    eventLog.length,
    finalStrategy,
    hasDerivedResults,
    maxGapFrames,
    openReviewFlags.length,
    outlierDistancePx,
    primaryErrors,
    sessionResults,
    smoothingWindow,
  ]);
  const processedPercent =
    hasTrackingSummary ? (trackingRun.processed / Math.max(1, trackingRun.total)) * 100 : null;
  const lowConfidenceFlags = reviewFlags.filter((flag) => flag.reason === 'low-confidence').length;
  const noDetectionFlags = reviewFlags.filter((flag) => flag.reason === 'no-detection').length;
  const highConfidenceAnnotations = Math.max(0, trackingRun.saved - lowConfidenceFlags);
  const reviewedFlags = reviewFlags.filter((flag) => flag.reviewed).length;

  const csv = useMemo(() => {
    const rows = [
      [
        'video',
        'duration_seconds',
        'fps',
        'target_well',
        'primary_latency_seconds',
        'total_latency_seconds',
        'primary_errors',
        'total_errors',
        'events_detected',
        'path_cm',
        'speed_cm_s',
        'target_quadrant_percent',
        'strategy',
        'frame_count',
        'frame_count_source',
        'frames_processed',
        'processing_percent',
        'draft_annotations',
        'high_confidence_annotations',
        'low_confidence_flags',
        'no_detection_flags',
        'reviewed_flags',
        'manual_corrections',
        'dwell_threshold_seconds',
        'nose_proxy_distance_cm',
        'platform_diameter_cm',
        'well_count',
        'analysis_version',
      ],
      [
        activeLabel,
        activeDuration.toFixed(2),
        fps.toFixed(3),
        targetHole,
        derivedPrimaryLatency !== null ? derivedPrimaryLatency.toFixed(1) : '',
        derivedTotalLatency !== null ? derivedTotalLatency.toFixed(1) : '',
        hasDerivedResults ? primaryErrors : '',
        hasDerivedResults ? adjustedErrors : '',
        eventLog.length,
        derivedPathCm !== null ? derivedPathCm.toFixed(1) : '',
        derivedSpeedCms !== null ? derivedSpeedCms.toFixed(2) : '',
        derivedTargetQuadrantPct !== null ? derivedTargetQuadrantPct.toFixed(1) : '',
        finalStrategy ?? '',
        totalFrames,
        frameCountSource,
        trackingRun.processed || '',
        processedPercent !== null ? processedPercent.toFixed(1) : '',
        trackingRun.saved || '',
        trackingRun.total > 0 ? highConfidenceAnnotations : '',
        trackingRun.total > 0 ? lowConfidenceFlags : '',
        trackingRun.total > 0 ? noDetectionFlags : '',
        trackingRun.total > 0 ? reviewedFlags : '',
        corrections,
        dwell.toFixed(2),
        distance.toFixed(2),
        platformDiameterCm.toFixed(1),
        holes.length,
        'classical-cv-v2-background',
      ],
    ];
    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  }, [
    activeDuration,
    activeLabel,
    adjustedErrors,
    corrections,
    derivedPathCm,
    derivedPrimaryLatency,
    derivedSpeedCms,
    derivedTargetQuadrantPct,
    derivedTotalLatency,
    distance,
    dwell,
    eventLog.length,
    frameCountSource,
    finalStrategy,
    fps,
    highConfidenceAnnotations,
    holes.length,
    hasDerivedResults,
    lowConfidenceFlags,
    noDetectionFlags,
    primaryErrors,
    processedPercent,
    reviewedFlags,
    platformDiameterCm,
    targetHole,
    totalFrames,
    trackingRun.processed,
    trackingRun.saved,
    trackingRun.total,
  ]);
  const eventCsv = useMemo(() => {
    const rows = [
      [
        'video',
        'event_id',
        'event_type',
        'source',
        'well',
        'start_frame_1_based',
        'end_frame_1_based',
        'time_seconds',
        'duration_seconds',
        'event_confidence',
        'detection_confidence',
        'review_status',
        'is_terminal',
        'analysis_version',
      ],
      ...eventLog.map((event) => [
        activeLabel,
        event.id,
        event.type,
        event.source,
        event.hole,
        event.startFrame + 1,
        event.endFrame + 1,
        event.timeSeconds.toFixed(3),
        event.durationSeconds.toFixed(3),
        event.confidence.toFixed(3),
        event.detectionConfidence.toFixed(3),
        reviewFlags.some(
          (flag) => flag.frame >= event.startFrame && flag.frame <= event.endFrame && !flag.reviewed,
        )
          ? 'needs-review'
          : event.source === 'manual'
            ? 'manual'
            : 'auto-draft',
        event.terminal ? 'true' : 'false',
        'classical-cv-v2-background',
      ]),
    ];
    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  }, [activeLabel, eventLog, reviewFlags]);
  const cohortCsv = useMemo(() => {
    const rows = [
      [
        'video',
        'analysis_status',
        'duration_seconds',
        'fps',
        'frame_count',
        'frames_processed',
        'draft_annotations',
        'open_review_flags',
        'primary_latency_seconds',
        'total_latency_seconds',
        'primary_errors',
        'total_errors',
        'events_detected',
        'path_cm',
        'speed_cm_s',
        'target_quadrant_percent',
        'strategy',
        'dwell_threshold_seconds',
        'nose_proxy_distance_cm',
        'platform_diameter_cm',
        'well_count',
        'analysis_version',
        'smoothing_window_frames',
        'max_gap_fill_frames',
        'outlier_distance_px',
      ],
      ...Object.values(sessionResultsWithCurrentSettings).map((result) => [
        result.video,
        result.status,
        result.durationSeconds.toFixed(2),
        result.fps.toFixed(3),
        result.frameCount,
        result.framesProcessed,
        result.framesSaved,
        result.flagsOpen,
        result.primaryLatency?.toFixed(3) ?? '',
        result.totalLatency?.toFixed(3) ?? '',
        result.primaryErrors ?? '',
        result.totalErrors ?? '',
        result.events,
        result.pathCm?.toFixed(3) ?? '',
        result.speedCms?.toFixed(3) ?? '',
        result.targetQuadrantPct?.toFixed(3) ?? '',
        result.strategy ?? '',
        result.dwellThresholdSeconds?.toFixed(2) ?? '',
        result.noseProxyDistanceCm?.toFixed(2) ?? '',
        result.platformDiameterCm?.toFixed(1) ?? '',
        result.wellCount ?? '',
        result.analysisVersion ?? '',
        result.smoothingWindow ?? '',
        result.maxGapFrames ?? '',
        result.outlierDistancePx ?? '',
      ]),
    ];
    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  }, [sessionResultsWithCurrentSettings]);

  function createSettingsSnapshot(): SettingsSnapshot {
    return {
      targetHole,
      selectedWellId,
      dwell,
      distance,
      platformDiameterCm,
      platform: { ...platform },
      holes: holes.map((hole) => ({ ...hole })),
      holeScale,
      rotationDegrees,
      smoothingWindow,
      maxGapFrames,
      outlierDistancePx,
    };
  }

  function applySettingsSnapshot(settings: SettingsSnapshot) {
    const nextHoles = settings.holes.map((hole) => ({ ...hole }));
    if (nextHoles.length === 0) return;
    const validTarget = nextHoles.some((hole) => hole.id === settings.targetHole)
      ? settings.targetHole
      : nextHoles[0].id;
    const validSelected = nextHoles.some((hole) => hole.id === settings.selectedWellId)
      ? settings.selectedWellId
      : validTarget;
    setTargetHole(validTarget);
    setSelectedWellId(validSelected);
    setDwell(settings.dwell);
    setDistance(settings.distance);
    setPlatformDiameterCm(settings.platformDiameterCm);
    setPlatform({ ...settings.platform });
    setHoles(nextHoles);
    setHoleScale(settings.holeScale);
    setRotationDegrees(settings.rotationDegrees);
    setSmoothingWindow(settings.smoothingWindow ?? 0);
    setMaxGapFrames(settings.maxGapFrames ?? 0);
    setOutlierDistancePx(settings.outlierDistancePx ?? 90);
  }

  function persistSettingsPresets(presets: SettingsPreset[], activePresetId: number | null) {
    window.localStorage.setItem(
      settingsPresetStorageKey,
      JSON.stringify({ presets, activePresetId }),
    );
  }

  function saveSettingsPreset(id: number) {
    const nextPresets = settingsPresets.map((preset) =>
      preset.id === id ? { ...preset, settings: createSettingsSnapshot() } : preset,
    );
    setSettingsPresets(nextPresets);
    setActiveSettingsPresetId(id);
    persistSettingsPresets(nextPresets, id);
  }

  function loadSettingsPreset(id: number) {
    const preset = settingsPresets.find((candidate) => candidate.id === id);
    if (!preset?.settings) return;
    applySettingsSnapshot(preset.settings);
    setActiveSettingsPresetId(id);
    persistSettingsPresets(settingsPresets, id);
  }

  function applyActiveSettingsPreset() {
    const preset = settingsPresets.find((candidate) => candidate.id === activeSettingsPresetId);
    if (preset?.settings) applySettingsSnapshot(preset.settings);
  }

  useEffect(() => {
    uploadedVideosRef.current = uploadedVideos;
  }, [uploadedVideos]);

  useEffect(() => {
    return () => {
      uploadedVideosRef.current.forEach((video) => URL.revokeObjectURL(video.url));
    };
  }, []);

  useEffect(() => {
    const restoreId = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(annotationStorageKey);
        if (stored) setAnnotationStore(JSON.parse(stored) as AnnotationStore);
      } catch {
        setAnnotationStore({});
      } finally {
        setHasLoadedLocalAnnotations(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreId);
  }, []);

  useEffect(() => {
    if (!hasLoadedLocalAnnotations) return;
    window.localStorage.setItem(annotationStorageKey, JSON.stringify(annotationStore));
  }, [annotationStore, hasLoadedLocalAnnotations]);

  useEffect(() => {
    const restoreId = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(settingsPresetStorageKey);
        if (!stored) return;
        const parsed = JSON.parse(stored) as {
          presets?: SettingsPreset[];
          activePresetId?: number | null;
        };
        const restored = emptySettingsPresets.map((slot) => {
          const savedSlot = parsed.presets?.find((preset) => preset.id === slot.id);
          return savedSlot?.settings ? savedSlot : slot;
        });
        setSettingsPresets(restored);
        const activePreset = restored.find((preset) => preset.id === parsed.activePresetId);
        if (activePreset?.settings) {
          applySettingsSnapshot(activePreset.settings);
          setActiveSettingsPresetId(activePreset.id);
        }
      } catch {
        setSettingsPresets(emptySettingsPresets);
      }
    }, 0);

    return () => window.clearTimeout(restoreId);
  }, []);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext?.registerTool) return;

    const lifecycle = new AbortController();

    void Promise.resolve(
      modelContext.registerTool(
        {
          name: 'read_current_trial',
          title: 'Read current trial',
          description:
            'Return the currently selected Barnes maze trial, thresholds, ROI, corrections, and generated metrics.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            return {
              video: activeLabel,
              currentFrame,
              targetHole,
              selectedWellId,
              thresholds: {
                dwellSeconds: dwell,
                noseProxyDistanceCm: distance,
                platformDiameterCm,
                pixelsPerCm,
              },
              layers,
              roi: { platform, holes, holeScale, rotationDegrees },
              corrections: {
                skeletons,
                selectedSkeletonId,
                events,
                count: corrections,
                savedFrameCount,
                frameTouched: frameAnnotation.touched,
              },
              frameAnalysis,
              trackingRun,
              eventLog,
              reviewQueue: {
                flags: reviewFlags,
                openCount: openReviewFlags.length,
                groups: reviewGroups,
                openGroupCount: openReviewGroups.length,
                currentFrameGroup: currentReviewGroup ?? null,
              },
              quality: {
                processingPercent: processedPercent,
                highConfidenceAnnotations,
                lowConfidenceFlags,
                noDetectionFlags,
                reviewedFlags,
                failedFrames: reviewFlags.length,
              },
              metrics: {
                primaryLatencySeconds: derivedPrimaryLatency,
                totalLatencySeconds: derivedTotalLatency,
                primaryErrors: hasDerivedResults ? primaryErrors : null,
                totalErrors: hasDerivedResults ? adjustedErrors : null,
                pathCm: derivedPathCm,
                speedCmPerSecond: derivedSpeedCms,
                targetQuadrantPercent: derivedTargetQuadrantPct,
                strategy: finalStrategy,
                strategySource: strategyOverride === 'auto' ? 'auto' : 'manual',
                strategyReason: autoStrategy.reason,
              },
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, [
    activeLabel,
    adjustedErrors,
    corrections,
    currentFrame,
    distance,
    dwell,
    derivedPathCm,
    derivedPrimaryLatency,
    derivedSpeedCms,
    derivedTargetQuadrantPct,
    derivedTotalLatency,
    eventLog,
    events,
    finalStrategy,
    hasDerivedResults,
    holes,
    holeScale,
    layers,
    platform,
    rotationDegrees,
    selected,
    selectedWellId,
    selectedSkeletonId,
    skeletons,
    savedFrameCount,
    targetHole,
    frameAnnotation.touched,
    frameAnalysis,
    reviewFlags,
    reviewGroups,
    openReviewFlags.length,
    openReviewGroups.length,
    currentReviewGroup,
    platformDiameterCm,
    pixelsPerCm,
    primaryErrors,
    processedPercent,
    highConfidenceAnnotations,
    lowConfidenceFlags,
    noDetectionFlags,
    reviewedFlags,
    strategyOverride,
    autoStrategy.reason,
    trackingRun,
  ]);

  function persistCurrentSessionResult() {
    setSessionResults((current) => {
      const result = current[activeVideoKey];
      if (!result) return current;
      return {
        ...current,
        [activeVideoKey]: {
          ...result,
          pathCm: derivedPathCm,
          speedCms: derivedSpeedCms,
          targetQuadrantPct: derivedTargetQuadrantPct,
          flagsOpen: openReviewFlags.length,
          primaryLatency: derivedPrimaryLatency,
          totalLatency: derivedTotalLatency,
          primaryErrors: hasDerivedResults ? primaryErrors : null,
          totalErrors: hasDerivedResults ? adjustedErrors : null,
          events: eventLog.length,
          strategy: finalStrategy,
          smoothingWindow,
          maxGapFrames,
          outlierDistancePx,
        },
      };
    });
  }

  function selectSample(sample: SampleVideo) {
    persistCurrentSessionResult();
    setTrackingRunsByVideo((current) => ({ ...current, [activeVideoKey]: trackingRun }));
    setActiveUploadedVideoId(null);
    setSelectedId(sample.id);
    setTargetHole(sample.targetHole);
    setPlatform(sample.platform);
    const nextHoles = buildHolePoints(sample.platform, 0.92, 0);
    setHoles(nextHoles);
    setSelectedWellId(sample.targetHole);
    setHoleScale(0.92);
    setRotationDegrees(0);
    setFps(sample.fpsValue);
    setStrategyOverride('auto');
    setCurrentTime(0);
    setCurrentFrameIndex(0);
    expectedSeekFrameRef.current = null;
    setToolMode('select');
    setFrameAnalysis(initialAnalysis);
    setTrackingRun(trackingRunsByVideo[sample.id] ?? initialTrackingRun);
    setReviewFlagsByVideo((current) => ({ ...current, [sample.id]: current[sample.id] ?? [] }));
    applyActiveSettingsPreset();
  }

  function resetForLocalVideo() {
    setCurrentTime(0);
    setCurrentFrameIndex(0);
    expectedSeekFrameRef.current = null;
    setIsPlaying(false);
    setStrategyOverride('auto');
    setFrameAnalysis({ ...initialAnalysis, source: 'video' });
  }

  function selectUploadedVideo(video: UploadedVideo) {
    persistCurrentSessionResult();
    if (uploadedVideo) {
      setWorkspaceSettingsByVideo((current) => ({ ...current, [activeVideoKey]: createSettingsSnapshot() }));
      setTrackingRunsByVideo((current) => ({ ...current, [activeVideoKey]: trackingRun }));
    }
    const nextKey = `local:${video.id}`;
    setActiveUploadedVideoId(video.id);
    resetForLocalVideo();
    const savedSettings = workspaceSettingsByVideo[nextKey];
    if (savedSettings) {
      applySettingsSnapshot(savedSettings);
    } else {
      applyActiveSettingsPreset();
    }
    setTrackingRun(trackingRunsByVideo[nextKey] ?? initialTrackingRun);
  }

  function loadVideos(files: FileList | File[]) {
    const knownIds = new Set(uploadedVideos.map((video) => video.id));
    const nextVideos = Array.from(files)
      .filter((file) => file.type.startsWith('video/') && !knownIds.has(`${file.name}-${file.size}-${file.lastModified}`))
      .map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      url: URL.createObjectURL(file),
      durationSeconds: 0,
      width: 640,
      height: 480,
      }));
    if (nextVideos.length === 0) {
      setProjectNotice('No new video files were added.');
      return;
    }
    setUploadedVideos((current) => [...current, ...nextVideos]);
    selectUploadedVideo(nextVideos[0]);
    setProjectNotice(`${nextVideos.length} video${nextVideos.length === 1 ? '' : 's'} added to this session.`);
  }

  function loadProject(file: File) {
    const reader = new FileReader();
    reader.onerror = () => setProjectNotice('Unable to read that project file.');
    reader.onload = () => {
      try {
        if (typeof reader.result !== 'string') throw new Error('Project file is not text');
        const project = JSON.parse(reader.result) as {
          schemaVersion?: number;
          annotationStore?: AnnotationStore;
          reviewFlagsByVideo?: ReviewFlagsByVideo;
          sessionResults?: Record<string, SessionResult>;
          workspaceSettingsByVideo?: Record<string, SettingsSnapshot>;
          trackingRunsByVideo?: Record<string, TrackingRun>;
          settings?: SettingsSnapshot;
          strategyOverride?: 'auto' | SearchStrategy;
          corrections?: number;
          layers?: LayerVisibility;
        };
        if (project.schemaVersion !== 2 || !project.settings || !project.annotationStore) {
          throw new Error('Unsupported project file');
        }
        applySettingsSnapshot(project.settings);
        setAnnotationStore(project.annotationStore);
        setReviewFlagsByVideo(project.reviewFlagsByVideo ?? {});
        setSessionResults(project.sessionResults ?? {});
        setWorkspaceSettingsByVideo(project.workspaceSettingsByVideo ?? {});
        setTrackingRunsByVideo(project.trackingRunsByVideo ?? {});
        setStrategyOverride(project.strategyOverride ?? 'auto');
        setCorrections(project.corrections ?? 0);
        setLayers({
          maze: project.layers?.maze ?? true,
          wells: project.layers?.wells ?? true,
          skeletons: project.layers?.skeletons ?? true,
          trajectory: project.layers?.trajectory ?? true,
          events: project.layers?.events ?? true,
        });
        setProjectNotice('Project restored. Add the same video files to reconnect their annotations.');
      } catch {
        setProjectNotice('This file is not a compatible BarnesTrack project.');
      }
    };
    reader.readAsText(file);
  }

  function seekToFrame(frame: number) {
    const safeFrame = clamp(frame, 0, totalFrames - 1);
    const nextTime = safeFrame / fps;
    setFrameAnalysis({ ...initialAnalysis, source: uploadedVideo ? 'video' : 'sample' });
    setCurrentFrameIndex(safeFrame);
    expectedSeekFrameRef.current = safeFrame;
    const video = videoRef.current;
    if (video) {
      video.pause();
      setIsPlaying(false);
      if ('fastSeek' in video && typeof video.fastSeek === 'function') {
        video.fastSeek(nextTime);
      } else {
        video.currentTime = nextTime;
      }
    }
    setCurrentTime(nextTime);
  }

  function syncRenderedVideoTime(time: number) {
    setCurrentTime(time);
    const expectedFrame = expectedSeekFrameRef.current;
    if (expectedFrame !== null) {
      setCurrentFrameIndex(expectedFrame);
      return;
    }
    setCurrentFrameIndex(clamp(Math.round(time * fps), 0, totalFrames - 1));
  }

  function stepFrame(delta: number) {
    seekToFrame(currentFrame + delta);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) {
      setIsPlaying((value) => !value);
      return;
    }
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepFrame(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepFrame(1);
      }
      if (event.key === ' ') {
        event.preventDefault();
        togglePlayback();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function updatePlatform(key: keyof Platform, value: number) {
    const delta = value - platform[key];
    setPlatform((current) => ({ ...current, [key]: value }));
    if (key === 'x') setHoles((current) => current.map((hole) => ({ ...hole, x: hole.x + delta })));
    if (key === 'y') setHoles((current) => current.map((hole) => ({ ...hole, y: hole.y + delta })));
    if (key === 'r') {
      const ratio = value / Math.max(1, platform.r);
      setHoles((current) =>
        current.map((hole) => ({
          ...hole,
          x: platform.x + (hole.x - platform.x) * ratio,
          y: platform.y + (hole.y - platform.y) * ratio,
        })),
      );
    }
  }

  function updateHoleTemplate(nextScale: number, nextRotation: number) {
    setHoleScale(nextScale);
    setRotationDegrees(nextRotation);
    const currentRadii = new Map(holes.map((hole) => [hole.id, hole.radius]));
    setHoles(
      buildWellPoints(platform, nextScale, nextRotation, Math.max(1, holes.length)).map((hole) => ({
        ...hole,
        radius: currentRadii.get(hole.id) ?? hole.radius,
      })),
    );
  }

  function resetRoi() {
    setPlatform(selected.platform);
    setHoleScale(0.92);
    setRotationDegrees(0);
    setHoles(buildHolePoints(selected.platform, 0.92, 0));
    setTargetHole(selected.targetHole);
    setSelectedWellId(selected.targetHole);
    setAnnotationStore((current) => {
      const next = { ...current };
      delete next[activeVideoKey];
      return next;
    });
  }

  function updateFrameAnnotation(updater: (annotation: FrameAnnotation) => FrameAnnotation) {
    setAnnotationStore((current) => {
      const currentVideoAnnotations = current[activeVideoKey] ?? {};
      const baseAnnotation =
        currentVideoAnnotations[frameKey] ??
        (uploadedVideo ? makeEmptyFrameAnnotation() : makeFrameAnnotation(selected.mouse));
      const nextAnnotation = updater(baseAnnotation);
      return {
        ...current,
        [activeVideoKey]: {
          ...currentVideoAnnotations,
          [frameKey]: { ...nextAnnotation, touched: true },
        },
      };
    });
  }

  function selectSkeleton(skeletonId: number) {
    updateFrameAnnotation((annotation) => ({ ...annotation, selectedSkeletonId: skeletonId }));
  }

  function updateSkeletonNode(
    skeletonId: number,
    node: 'body' | 'nose',
    point: Point,
  ) {
    updateFrameAnnotation((annotation) => ({
      ...annotation,
      skeletons: annotation.skeletons.map((skeleton) =>
        skeleton.id === skeletonId ? { ...skeleton, [node]: point } : skeleton,
      ),
      selectedSkeletonId: skeletonId,
      detectionConfidence: undefined,
    }));
  }

  function addSkeleton(point = { x: 320, y: 240 }) {
    const nextId = Math.max(0, ...skeletons.map((skeleton) => skeleton.id)) + 1;
    const nextSkeleton = makeSkeleton(nextId, point);
    updateFrameAnnotation((annotation) => ({
      ...annotation,
      skeletons: [...annotation.skeletons, nextSkeleton],
      selectedSkeletonId: nextId,
      detectionConfidence: undefined,
    }));
    setLayers((current) => ({ ...current, skeletons: true }));
    setCorrections((value) => value + 1);
  }

  function removeSelectedSkeleton() {
    if (!selectedSkeleton) return;
    const nextSkeletons = skeletons.filter((skeleton) => skeleton.id !== selectedSkeleton.id);
    updateFrameAnnotation((annotation) => ({
      ...annotation,
      skeletons: nextSkeletons,
      selectedSkeletonId: nextSkeletons[0]?.id ?? 0,
      detectionConfidence: undefined,
    }));
    setCorrections((value) => value + 1);
  }

  function addWell() {
    const nextId = Math.max(0, ...holes.map((hole) => hole.id)) + 1;
    const angle =
      -Math.PI / 2 +
      (rotationDegrees * Math.PI) / 180 +
      (holes.length / Math.max(1, holes.length + 1)) * Math.PI * 2;
    const ringRadius = platform.r * holeScale;
    const nextWell = {
      id: nextId,
      x: clamp(platform.x + Math.cos(angle) * ringRadius, 0, 640),
      y: clamp(platform.y + Math.sin(angle) * ringRadius, 0, 480),
      radius: selectedWell?.radius ?? 10,
    };
    setHoles((current) => [...current, nextWell]);
    setSelectedWellId(nextId);
    setLayers((current) => ({ ...current, wells: true }));
  }

  function updateSelectedWellRadius(radius: number) {
    if (!selectedWell) return;
    setHoles((current) =>
      current.map((hole) =>
        hole.id === selectedWell.id ? { ...hole, radius: clamp(radius, 4, 28) } : hole,
      ),
    );
  }

  function updateAllWellRadii(radius: number) {
    setHoles((current) => current.map((hole) => ({ ...hole, radius: clamp(radius, 4, 28) })));
  }

  function removeSelectedWell() {
    if (!selectedWell || holes.length <= 1) return;
    const nextSelectedWell = holes.find((hole) => hole.id !== selectedWell.id);
    setHoles((current) => current.filter((hole) => hole.id !== selectedWell.id));
    if (nextSelectedWell) {
      setSelectedWellId(nextSelectedWell.id);
      if (targetHole === selectedWell.id) setTargetHole(nextSelectedWell.id);
    }
  }

  function saveCurrentFrame() {
    updateFrameAnnotation((annotation) => ({ ...annotation, detectionConfidence: undefined }));
    setCorrections((value) => value + 1);
  }

  function clearCurrentFrame() {
    updateFrameAnnotation((annotation) => ({
      ...annotation,
      skeletons: [],
      selectedSkeletonId: 0,
      events: [],
      detectionConfidence: undefined,
    }));
    setCorrections((value) => value + 1);
  }

  function analyzeImageData(
    imageData: ImageData,
    referenceBody?: Point,
    previousImageData?: ImageData,
    background?: BackgroundModel,
  ): FrameAnalysis {
    const { data, width, height } = imageData;
    const hasPreviousFrame =
      previousImageData?.width === width && previousImageData.height === height;
    const insideRoi = new Uint8Array(width * height);
    const candidates = new Uint8Array(width * height);
    let roiPixels = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const platformDistance = Math.hypot(x - platform.x, y - platform.y);
        if (platformDistance >= platform.r * 0.96) continue;
        const index = y * width + x;
        insideRoi[index] = 1;
        roiPixels += 1;
      }
    }

    if (roiPixels < 1000) {
      return {
        ...initialAnalysis,
        status: 'error',
        message: 'ROI is too small for frame analysis',
        source: uploadedVideo ? 'video' : 'sample',
      };
    }

    const hasBackground = background?.width === width && background.height === height;
    let foregroundPixels = 0;

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (!insideRoi[index]) continue;
        const offset = index * 4;
        const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
        const backgroundLuminance = hasBackground ? background.luminance[index] : 255;
        // A well is dark but stationary; a mouse is a dark foreground object.
        // Do not mask wells: retain their pixels only when they differ from
        // the learned background, which also permits a mouse to cover a well.
        const isDarkForeground = hasBackground
          ? backgroundLuminance - luminance >= 14
          : luminance < 85;
        if (isDarkForeground) {
          candidates[index] = 1;
          foregroundPixels += 1;
        }
      }
    }

    const visited = new Uint8Array(width * height);
    const plausibleComponents: Array<{
      pixels: number;
      motionPixels: number;
      contrastSum: number;
      sumX: number;
      sumY: number;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    }> = [];

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const startIndex = y * width + x;
        if (!candidates[startIndex] || visited[startIndex]) continue;

        const stack = [startIndex];
        visited[startIndex] = 1;
        let pixels = 0;
        let motionPixels = 0;
        let contrastSum = 0;
        let sumX = 0;
        let sumY = 0;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;

        while (stack.length > 0) {
          const index = stack.pop();
          if (index === undefined) continue;
          const pixelX = index % width;
          const pixelY = Math.floor(index / width);
          pixels += 1;
          if (hasPreviousFrame) {
            const offset = index * 4;
            const previous = previousImageData.data;
            const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
            const previousLuminance =
              previous[offset] * 0.299 + previous[offset + 1] * 0.587 + previous[offset + 2] * 0.114;
            if (Math.abs(luminance - previousLuminance) >= 16) motionPixels += 1;
          }
          if (hasBackground) {
            const offset = index * 4;
            const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
            contrastSum += Math.max(0, background.luminance[index] - luminance);
          }
          sumX += pixelX;
          sumY += pixelY;
          minX = Math.min(minX, pixelX);
          maxX = Math.max(maxX, pixelX);
          minY = Math.min(minY, pixelY);
          maxY = Math.max(maxY, pixelY);

          const neighbors = [index - 1, index + 1, index - width, index + width];
          for (const neighbor of neighbors) {
            if (neighbor < 0 || neighbor >= candidates.length) continue;
            if (!candidates[neighbor] || visited[neighbor]) continue;
            visited[neighbor] = 1;
            stack.push(neighbor);
          }
        }

        const componentWidth = maxX - minX + 1;
        const componentHeight = maxY - minY + 1;
        const plausibleSize = pixels >= 18 && pixels <= 3200;
        const plausibleShape = componentWidth <= platform.r * 0.55 && componentHeight <= platform.r * 0.55;
        if (plausibleSize && plausibleShape) {
          plausibleComponents.push({
            pixels,
            motionPixels,
            contrastSum,
            sumX,
            sumY,
            minX,
            maxX,
            minY,
            maxY,
          });
        }
      }
    }

    let bestComponent = plausibleComponents.reduce<typeof plausibleComponents[number] | null>(
      (best, candidate) => {
        if (!best) return candidate;
        const candidateScore = candidate.contrastSum / Math.max(1, candidate.pixels) +
          candidate.motionPixels / Math.max(1, candidate.pixels) * 12;
        const bestScore = best.contrastSum / Math.max(1, best.pixels) +
          best.motionPixels / Math.max(1, best.pixels) * 12;
        return candidateScore > bestScore ? candidate : best;
      },
      null,
    );

    if (referenceBody && plausibleComponents.length > 0) {
      let closest: { component: (typeof plausibleComponents)[number]; distance: number } | null = null;
      for (const candidate of plausibleComponents) {
        const body = { x: candidate.sumX / candidate.pixels, y: candidate.sumY / candidate.pixels };
        const distance = Math.hypot(body.x - referenceBody.x, body.y - referenceBody.y);
        if (!closest || distance < closest.distance) closest = { component: candidate, distance };
      }
      const maxFrameTravelPx = 48;
      if (!closest || closest.distance > maxFrameTravelPx) {
        return {
          status: 'error',
          message: 'No foreground animal component near the previous frame',
          confidence: 0,
          source: uploadedVideo ? 'video' : 'sample',
          darkPixels: foregroundPixels,
          componentPixels: 0,
        };
      }
      bestComponent = closest.component;
    }

    if (!bestComponent) {
      return {
        status: 'error',
        message: hasPreviousFrame
          ? 'No foreground animal-sized component found'
          : 'No plausible animal-sized dark component found',
        confidence: 0,
        source: uploadedVideo ? 'video' : 'sample',
        darkPixels: foregroundPixels,
        componentPixels: 0,
      };
    }

    const body = {
      x: bestComponent.sumX / bestComponent.pixels,
      y: bestComponent.sumY / bestComponent.pixels,
    };
    const nearestTarget = holes.reduce((nearest, hole) => {
      const holeDistance = Math.hypot(hole.x - body.x, hole.y - body.y);
      return holeDistance < nearest.distance ? { hole, distance: holeDistance } : nearest;
    }, { hole: holes[0] ?? null, distance: Infinity }).hole;
    if (!nearestTarget) {
      return {
        status: 'error',
        message: 'No wells are available for nose direction estimation',
        confidence: 0,
        source: uploadedVideo ? 'video' : 'sample',
        darkPixels: foregroundPixels,
        componentPixels: bestComponent.pixels,
      };
    }
    const vectorLength = Math.max(1, Math.hypot(nearestTarget.x - body.x, nearestTarget.y - body.y));
    const nose = {
      x: clamp(body.x + ((nearestTarget.x - body.x) / vectorLength) * 14, 0, width),
      y: clamp(body.y + ((nearestTarget.y - body.y) / vectorLength) * 14, 0, height),
    };
    const contrast = bestComponent.contrastSum / Math.max(1, bestComponent.pixels);
    const motionScore = hasPreviousFrame
      ? bestComponent.motionPixels / Math.max(1, bestComponent.pixels)
      : 0.5;
    const continuityScore = referenceBody
      ? clamp(1 - Math.hypot(body.x - referenceBody.x, body.y - referenceBody.y) / 48, 0, 1)
      : 0.5;
    const confidence = clamp(
      0.15 + clamp((contrast - 14) / 60, 0, 1) * 0.5 + motionScore * 0.1 + continuityScore * 0.25,
      0.15,
      0.95,
    );

    return {
      status: 'ready',
      message: `Detected foreground component at ${Math.round(body.x)}, ${Math.round(body.y)}`,
      confidence,
      source: uploadedVideo ? 'video' : 'sample',
      darkPixels: foregroundPixels,
      componentPixels: bestComponent.pixels,
      body,
      nose,
    };
  }

  function readRenderedImageData(source: CanvasImageSource) {
    const canvas = analysisCanvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !context) throw new Error('Frame canvas is not available');

    canvas.width = 640;
    canvas.height = 480;
    context.clearRect(0, 0, 640, 480);
    context.drawImage(source, 0, 0, 640, 480);
    return context.getImageData(0, 0, 640, 480);
  }

  function buildBackgroundModel(frames: ImageData[]): BackgroundModel | null {
    const firstFrame = frames[0];
    if (!firstFrame || frames.some((frame) => frame.width !== firstFrame.width || frame.height !== firstFrame.height)) {
      return null;
    }
    const pixelCount = firstFrame.width * firstFrame.height;
    const sums = new Float32Array(pixelCount);
    const minimums = new Uint8Array(pixelCount);
    const maximums = new Uint8Array(pixelCount);
    minimums.fill(255);

    for (const frame of frames) {
      for (let index = 0; index < pixelCount; index += 1) {
        const offset = index * 4;
        const luminance = Math.round(
          frame.data[offset] * 0.299 + frame.data[offset + 1] * 0.587 + frame.data[offset + 2] * 0.114,
        );
        sums[index] += luminance;
        minimums[index] = Math.min(minimums[index], luminance);
        maximums[index] = Math.max(maximums[index], luminance);
      }
    }

    const divisor = frames.length >= 5 ? frames.length - 2 : frames.length;
    const luminance = new Float32Array(pixelCount);
    for (let index = 0; index < pixelCount; index += 1) {
      // A trimmed temporal mean removes a mouse that appears in one or two
      // background samples, while preserving stationary wells and shadows.
      luminance[index] = frames.length >= 5
        ? (sums[index] - minimums[index] - maximums[index]) / divisor
        : sums[index] / divisor;
    }
    return { width: firstFrame.width, height: firstFrame.height, luminance };
  }

  async function learnVideoBackground(
    video: HTMLVideoElement,
    startFrame: number,
    frameCount: number,
  ) {
    const sampleCount = Math.min(15, Math.max(7, Math.ceil(frameCount / 180)));
    const frames: ImageData[] = [];
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      if (stopTrackingRef.current) break;
      const frame = startFrame + Math.round(
        ((sampleIndex + 0.5) / sampleCount) * Math.max(0, frameCount - 1),
      );
      await waitForVideoSeek(video, frame / fps);
      frames.push(readRenderedImageData(video));
    }
    return buildBackgroundModel(frames);
  }

  function readRenderedFrameAnalysis(
    source: CanvasImageSource,
    referenceBody?: Point,
    previousImageData?: ImageData,
  ) {
    return analyzeImageData(readRenderedImageData(source), referenceBody, previousImageData);
  }

  function writeAnalysisToCurrentFrame(result: FrameAnalysis) {
    if (result.status !== 'ready' || !result.body || !result.nose) return;
    const nextId = selectedSkeleton?.id ?? 1;
    updateFrameAnnotation((annotation) => {
      const nextSkeleton = {
        id: nextId,
      label: `Animal ${nextId}`,
        body: result.body as Point,
        nose: result.nose as Point,
      };
      const hasSkeleton = annotation.skeletons.some((skeleton) => skeleton.id === nextId);
      return {
        ...annotation,
        skeletons: hasSkeleton
          ? annotation.skeletons.map((skeleton) =>
              skeleton.id === nextId ? nextSkeleton : skeleton,
            )
          : [...annotation.skeletons, nextSkeleton],
        selectedSkeletonId: nextId,
        detectionConfidence: result.confidence,
      };
    });
    setLayers((current) => ({ ...current, skeletons: true }));
  }

  function analyzeCurrentFrame() {
    const source = uploadedVideo ? videoRef.current : frameImageRef.current;

    try {
      if (!source) throw new Error('Frame source is not available');
      const result = readRenderedFrameAnalysis(source);
      setFrameAnalysis(result);
      writeAnalysisToCurrentFrame(result);
    } catch (error) {
      setFrameAnalysis({
        ...initialAnalysis,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to read current frame',
        source: uploadedVideo ? 'video' : 'sample',
      });
    }
  }

  function waitForVideoSeek(video: HTMLVideoElement, time: number) {
    return new Promise<void>((resolve, reject) => {
      if (Math.abs(video.currentTime - time) < 0.0001) {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('Video seek timed out'));
      }, 2500);
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('error', handleError);
      };
      const handleSeeked = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new Error('Video seek failed'));
      };
      video.addEventListener('seeked', handleSeeked, { once: true });
      video.addEventListener('error', handleError, { once: true });
      video.currentTime = time;
    });
  }

  function stopTracking() {
    stopTrackingRef.current = true;
    setTrackingRun((current) => ({
      ...current,
      status: current.status === 'running' ? 'done' : current.status,
      message: current.status === 'running' ? 'Tracking stopped by user' : current.message,
    }));
  }

  function mergeReviewFlags(existing: ReviewFlag[], incoming: ReviewFlag[]) {
    const byFrame = new Map(existing.map((flag) => [flag.frame, flag]));
    for (const flag of incoming) {
      byFrame.set(flag.frame, { ...byFrame.get(flag.frame), ...flag });
    }
    return Array.from(byFrame.values()).sort((a, b) => a.frame - b.frame);
  }

  function unflagCurrentReviewGroupAndAdvance() {
    if (!currentReviewGroup) return;
    const nextGroup = openReviewGroups.find(
      (group) => group.startFrame > currentReviewGroup.endFrame,
    ) ?? null;
    setReviewFlagsByVideo((current) => ({
      ...current,
      [activeVideoKey]: (current[activeVideoKey] ?? []).map((flag) =>
        flag.frame >= currentReviewGroup.startFrame && flag.frame <= currentReviewGroup.endFrame
          ? { ...flag, reviewed: true }
          : flag,
      ),
    }));
    setCorrections((value) => value + 1);
    if (nextGroup) seekToFrame(nextGroup.startFrame);
  }

  function clearAllReviewFlags() {
    setReviewFlagsByVideo((current) => ({ ...current, [activeVideoKey]: [] }));
    setSessionResults((current) => {
      const result = current[activeVideoKey];
      return result
        ? { ...current, [activeVideoKey]: { ...result, flagsOpen: 0 } }
        : current;
    });
    setCorrections((value) => value + 1);
  }

  async function trackFrameRange(maxFrames: number, label: string) {
    const video = videoRef.current;
    if (!uploadedVideo || !video) {
      setTrackingRun({
        status: 'error',
        processed: 0,
        total: 0,
        saved: 0,
        message: 'Load a local MP4 before running multi-frame tracking',
      });
      return;
    }

    stopTrackingRef.current = false;
    video.pause();
    setIsPlaying(false);
    const startFrame = currentFrame;
    const framesToTrack = Math.min(maxFrames, totalFrames - startFrame);
    const trackedFrames: Record<string, FrameAnnotation> = {};
    const nextReviewFlags: ReviewFlag[] = [];
    const priorTrajectoryPoint = buildTrajectory(frameAnnotations, fps)
      .filter((point) => point.valid && point.frame < startFrame)
      .at(-1);
    let previousAcceptedBody = priorTrajectoryPoint
      ? { x: priorTrajectoryPoint.x, y: priorTrajectoryPoint.y }
      : undefined;
    let previousFrameImage: ImageData | undefined;
    let consecutiveTargetFrames = 0;
    let targetDwellReached = false;
    let consecutiveMissingFrames = 0;
    let stoppedForPossibleEscape = false;
    let hasLockedOnMouse = false;
    let trackingAnchorLost = false;
    let reacquisitionCount = 0;
    const targetWellForTracking = holes.find((hole) => hole.id === targetHole) ?? null;
    const minimumTargetDwellFrames = Math.max(1, Math.ceil(dwell * fps));
    const minimumEscapeMissingFrames = Math.max(3, Math.ceil(fps * 0.25));
    const maximumContinuousLossFrames = Math.max(8, Math.ceil(fps * 0.4));
    let processed = 0;
    let saved = 0;

    setTrackingRun({
      status: 'running',
      processed: 0,
      total: framesToTrack,
      saved: 0,
      message: `${label}: frames ${startFrame + 1}-${startFrame + framesToTrack}`,
    });

    try {
      setTrackingRun({
        status: 'running',
        processed: 0,
        total: framesToTrack,
        saved: 0,
        message: `${label}: learning static background`,
      });
      const backgroundModel = await learnVideoBackground(video, startFrame, framesToTrack);
      if (stopTrackingRef.current) return;

      for (let offset = 0; offset < framesToTrack; offset += 1) {
        if (stopTrackingRef.current) break;
        const frame = startFrame + offset;
        const time = frame / fps;
        await waitForVideoSeek(video, time);
        processed = offset + 1;
        const currentFrameImage = readRenderedImageData(video);
        const result = analyzeImageData(
          currentFrameImage,
          previousAcceptedBody,
          previousFrameImage,
          backgroundModel ?? undefined,
        );
        previousFrameImage = currentFrameImage;
        if (result.status === 'ready' && result.body && result.nose) {
          if (trackingAnchorLost) reacquisitionCount += 1;
          previousAcceptedBody = result.body;
          consecutiveMissingFrames = 0;
          hasLockedOnMouse = true;
          trackingAnchorLost = false;
          const noseIsAtTarget = targetWellForTracking
            ? Math.hypot(
                result.nose.x - targetWellForTracking.x,
                result.nose.y - targetWellForTracking.y,
              ) <= Math.max(10, targetWellForTracking.radius + 8)
            : false;
          consecutiveTargetFrames = noseIsAtTarget ? consecutiveTargetFrames + 1 : 0;
          targetDwellReached ||= consecutiveTargetFrames >= minimumTargetDwellFrames;
          const skeletonId = selectedSkeletonId || 1;
          trackedFrames[String(frame)] = {
            skeletons: [
              {
                id: skeletonId,
                label: `Animal ${skeletonId}`,
                body: result.body,
                nose: result.nose,
              },
            ],
            selectedSkeletonId: skeletonId,
            events: [],
            touched: true,
            detectionConfidence: result.confidence,
          };
          saved += 1;
          setFrameAnalysis(result);
          if (result.confidence < 0.35) {
            nextReviewFlags.push({
              frame,
              reason: 'low-confidence',
              confidence: result.confidence,
              reviewed: false,
            });
          }
        } else {
          consecutiveMissingFrames += 1;
          // Before the mouse first appears, blank arena frames are expected and
          // should not fill the review queue. After a lock, record only the
          // start of an ordinary loss; target losses retain every frame as
          // evidence for a possible escape.
          if (
            hasLockedOnMouse &&
            (consecutiveMissingFrames === 1 || targetDwellReached)
          ) {
            nextReviewFlags.push({
              frame,
              reason: 'no-detection',
              confidence: 0,
              reviewed: false,
            });
          }
          if (
            targetDwellReached &&
            consecutiveMissingFrames >= minimumEscapeMissingFrames
          ) {
            stoppedForPossibleEscape = true;
          }
          if (!targetDwellReached && consecutiveMissingFrames >= maximumContinuousLossFrames) {
            previousAcceptedBody = undefined;
            trackingAnchorLost = true;
          }
        }
        if (offset % 5 === 0 || offset === framesToTrack - 1) {
          setCurrentTime(time);
          setCurrentFrameIndex(frame);
          setTrackingRun({
            status: 'running',
            processed,
            total: framesToTrack,
            saved,
            message: `${label}: frame ${frame + 1}`,
          });
        }
        if (stoppedForPossibleEscape) break;
      }

      const processedEndFrame = startFrame + processed - 1;
      const retainManualAnnotations = (annotations: Record<string, FrameAnnotation>) =>
        Object.fromEntries(
          Object.entries(annotations).filter(([key, annotation]) => {
            const frame = Number(key);
            return (
              !Number.isFinite(frame) ||
              frame < startFrame ||
              frame > processedEndFrame ||
              annotation.detectionConfidence === undefined
            );
          }),
        );
      setAnnotationStore((current) => ({
        ...current,
        [activeVideoKey]: {
          ...retainManualAnnotations(current[activeVideoKey] ?? {}),
          ...trackedFrames,
        },
      }));
      const combinedAnnotations = {
        ...retainManualAnnotations(frameAnnotations),
        ...trackedFrames,
      };
      const retainedReviewFlags = reviewFlags.filter(
        (flag) => flag.frame < startFrame || flag.frame > processedEndFrame,
      );
      const combinedFlags = mergeReviewFlags(retainedReviewFlags, nextReviewFlags);
      const completedEvents = detectEventLog(
        combinedAnnotations,
        holes,
        targetHole,
        dwell,
        fps,
        combinedFlags,
      );
      const completedTrajectory = processTrajectory(
        buildTrajectory(combinedAnnotations, fps),
        smoothingWindow,
        maxGapFrames,
        outlierDistancePx,
      );
      const completedPathCm = pathLengthCm(completedTrajectory, pixelsPerCm);
      const completedValidTrajectory = completedTrajectory.filter((point) => point.valid);
      const completedDuration =
        completedValidTrajectory.length >= 2
          ? (completedValidTrajectory[completedValidTrajectory.length - 1].frame -
              completedValidTrajectory[0].frame) /
            fps
          : null;
      const completedSpeed =
        completedPathCm !== null && completedDuration !== null && completedDuration > 0
          ? completedPathCm / completedDuration
          : null;
      const completedTargetQuadrant = targetQuadrantPercent(
        completedTrajectory,
        platform,
        holes.find((hole) => hole.id === targetHole) ?? null,
      );
      const completedFirstTarget = completedEvents.find((event) => event.hole === targetHole);
      const completedFirstEscape = completedEvents.find((event) => event.type === 'escape');
      const completedPrimaryErrors = completedEvents.filter(
        (event) =>
          event.type === 'investigation' &&
          event.hole !== targetHole &&
          event.timeSeconds <= (completedFirstTarget?.timeSeconds ?? Infinity),
      ).length;
      const completedTotalErrors = completedEvents.filter(
        (event) => event.type === 'investigation' && event.hole !== targetHole,
      ).length;
      const completedStrategy = classifySearchStrategy(
        completedEvents,
        targetHole,
        holes.length,
        completedPrimaryErrors,
        completedTargetQuadrant,
      ).label;
      setReviewFlagsByVideo((current) => ({
        ...current,
        [activeVideoKey]: combinedFlags,
      }));
      setSessionResults((current) => ({
        ...current,
        [activeVideoKey]: {
          videoId: activeVideoKey,
          video: activeLabel,
          status: stopTrackingRef.current || processed < framesToTrack || framesToTrack < totalFrames
            ? 'partial'
            : 'complete',
          durationSeconds: activeDuration,
          fps,
          frameCount: totalFrames,
          framesProcessed: processed,
          framesSaved: saved,
          flagsOpen: combinedFlags.filter((flag) => !flag.reviewed).length,
          primaryLatency: completedFirstTarget?.timeSeconds ?? null,
          totalLatency: completedFirstEscape?.timeSeconds ?? null,
          primaryErrors: completedEvents.length > 0 ? completedPrimaryErrors : null,
          totalErrors: completedEvents.length > 0 ? completedTotalErrors : null,
          events: completedEvents.length,
          pathCm: completedPathCm,
          speedCms: completedSpeed,
          targetQuadrantPct: completedTargetQuadrant,
          strategy: completedStrategy,
          dwellThresholdSeconds: dwell,
          noseProxyDistanceCm: distance,
          platformDiameterCm,
          wellCount: holes.length,
          analysisVersion: 'classical-cv-v2-background',
          smoothingWindow,
          maxGapFrames,
          outlierDistancePx,
        },
      }));
      setLayers((current) => ({ ...current, skeletons: true }));
      setTrackingRun({
        status: 'done',
        processed,
        total: framesToTrack,
        saved,
        message: stopTrackingRef.current
          ? `Stopped after saving ${saved} frames`
          : stoppedForPossibleEscape
            ? `Stopped after ${consecutiveMissingFrames} missing frames following the target well`
            : `${label} saved ${saved} draft frame annotations${
                reacquisitionCount > 0 ? ` · reacquired ${reacquisitionCount} time${reacquisitionCount === 1 ? '' : 's'}` : ''
              }`,
      });
    } catch (error) {
      setTrackingRun({
        status: 'error',
        processed,
        total: framesToTrack,
        saved,
        message: error instanceof Error ? error.message : 'Tracking pass failed',
      });
    }
  }

  function trackNextFrames() {
    void trackFrameRange(60, 'Short pass');
  }

  function trackFullVideo() {
    void trackFrameRange(totalFrames - currentFrame, 'Full video');
  }

  function toggleLayer(layer: keyof LayerVisibility) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  function download(text: string, fileName: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadWorkbook(sheets: WorkbookSheet[], fileName: string) {
    const workbook = createXlsxWorkbook(sheets);
    const contents = new ArrayBuffer(workbook.byteLength);
    new Uint8Array(contents).set(workbook);
    const blob = new Blob([contents], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function stagePoint(event: React.PointerEvent<SVGSVGElement>): Point {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 640, 0, 640),
      y: clamp(((event.clientY - rect.top) / rect.height) * 480, 0, 480),
    };
  }

  function nearestHole(point: Point) {
    return holes.reduce((nearest, hole) => {
      const distanceToHole = Math.hypot(hole.x - point.x, hole.y - point.y);
      return distanceToHole < nearest.distance ? { hole, distance: distanceToHole } : nearest;
    }, { hole: holes[0] ?? null, distance: Infinity }).hole;
  }

  function nearestSkeleton(point: Point) {
    return skeletons.reduce<{
      skeleton: Skeleton | null;
      node: 'body' | 'nose' | null;
      distance: number;
    }>(
      (nearest, skeleton) => {
        const bodyDistance = Math.hypot(skeleton.body.x - point.x, skeleton.body.y - point.y);
        const noseDistance = Math.hypot(skeleton.nose.x - point.x, skeleton.nose.y - point.y);
        const distanceToSkeleton = Math.min(bodyDistance, noseDistance);
        return distanceToSkeleton < nearest.distance
          ? {
              skeleton,
              node: bodyDistance <= noseDistance ? 'body' : 'nose',
              distance: distanceToSkeleton,
            }
          : nearest;
      },
      { skeleton: null, node: null, distance: Infinity },
    );
  }

  function addEvent(type: 'investigation' | 'escape', point: Point) {
    const hole = nearestHole(point);
    if (!hole) return;
    if (Math.hypot(point.x - hole.x, point.y - hole.y) > hole.radius + 8) return;

    if (type === 'escape') {
      // A trial has one terminal escape. Choosing a new escape replaces an
      // earlier terminal mark, while clicking the same well/frame clears it.
      setAnnotationStore((current) => {
        const currentVideoAnnotations = current[activeVideoKey] ?? {};
        const baseAnnotation =
          currentVideoAnnotations[frameKey] ??
          (uploadedVideo ? makeEmptyFrameAnnotation() : makeFrameAnnotation(selected.mouse));
        const alreadyMarked = baseAnnotation.events.some(
          (event) => event.type === 'escape' && event.hole === hole.id,
        );
        const withoutEscapes = Object.fromEntries(
          Object.entries(currentVideoAnnotations).map(([key, annotation]) => [
            key,
            { ...annotation, events: annotation.events.filter((event) => event.type !== 'escape') },
          ]),
        );
        const currentAnnotation = withoutEscapes[frameKey] ?? {
          ...baseAnnotation,
          events: baseAnnotation.events.filter((event) => event.type !== 'escape'),
        };
        return {
          ...current,
          [activeVideoKey]: {
            ...withoutEscapes,
            [frameKey]: {
              ...currentAnnotation,
              events: alreadyMarked
                ? currentAnnotation.events
                : [
                    ...currentAnnotation.events,
                    { type, frame: currentFrame, hole: hole.id, source: 'manual' },
                  ],
              touched: true,
              detectionConfidence: undefined,
            },
          },
        };
      });
      setLayers((current) => ({ ...current, events: true }));
      setCorrections((value) => value + 1);
      return;
    }

    updateFrameAnnotation((annotation) => {
      const exists = annotation.events.some(
        (event) => event.type === type && event.hole === hole.id,
      );
      return {
        ...annotation,
        events: exists
          ? annotation.events.filter((event) => !(event.type === type && event.hole === hole.id))
          : [...annotation.events, { type, frame: currentFrame, hole: hole.id, source: 'manual' }],
        detectionConfidence: undefined,
      };
    });
    setLayers((current) => ({ ...current, events: true }));
    setCorrections((value) => value + 1);
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const point = stagePoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (toolMode === 'select') {
      if (!layers.skeletons) return;
      const nearest = nearestSkeleton(point);
      if (nearest.skeleton && nearest.node && nearest.distance <= 18) {
        selectSkeleton(nearest.skeleton.id);
        setDragTarget({
          type: nearest.node,
          skeletonId: nearest.skeleton.id,
        });
      }
      return;
    }
    if (toolMode === 'move-maze') {
      setDragTarget({ type: 'platform', start: point, origin: platform });
      return;
    }
    if (toolMode === 'move-hole' || toolMode === 'target') {
      const hole = nearestHole(point);
      if (!hole) return;
      setSelectedWellId(hole.id);
      if (toolMode === 'target') {
        setTargetHole(hole.id);
        return;
      }
      setDragTarget({ type: 'hole', id: hole.id });
      return;
    }
    if (toolMode === 'add-nodes') {
      addSkeleton(point);
      setToolMode('select');
      return;
    }
    if (toolMode === 'investigation') addEvent('investigation', point);
    if (toolMode === 'escape') addEvent('escape', point);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragTarget) return;
    const point = stagePoint(event);
    if (dragTarget.type === 'platform') {
      const dx = point.x - dragTarget.start.x;
      const dy = point.y - dragTarget.start.y;
      const nextPlatform = {
        ...dragTarget.origin,
        x: clamp(Math.round(dragTarget.origin.x + dx), 0, 640),
        y: clamp(Math.round(dragTarget.origin.y + dy), 0, 480),
      };
      setPlatform(nextPlatform);
      setHoles((current) => current.map((hole) => ({ ...hole, x: hole.x + dx, y: hole.y + dy })));
      setDragTarget({ type: 'platform', start: point, origin: nextPlatform });
      return;
    }
    if (dragTarget.type === 'hole') {
      setHoles((current) =>
        current.map((hole) =>
          hole.id === dragTarget.id ? { ...hole, x: point.x, y: point.y } : hole,
        ),
      );
      return;
    }
    if (dragTarget.type === 'body') updateSkeletonNode(dragTarget.skeletonId, 'body', point);
    if (dragTarget.type === 'nose') updateSkeletonNode(dragTarget.skeletonId, 'nose', point);
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (
      dragTarget?.type === 'body' ||
      dragTarget?.type === 'nose'
    ) {
      setCorrections((value) => value + 1);
    }
    setDragTarget(null);
  }

  const projectJson = JSON.stringify(
    {
      schemaVersion: 2,
      savedAt: new Date().toISOString(),
      localVideos: uploadedVideos.map(({ id, name, durationSeconds, width, height }) => ({
        id,
        name,
        durationSeconds,
        width,
        height,
      })),
      activeVideo: activeLabel,
      settings: createSettingsSnapshot(),
      layers,
      annotationStore,
      reviewFlagsByVideo,
      sessionResults: sessionResultsWithCurrentSettings,
      workspaceSettingsByVideo: uploadedVideo
        ? { ...workspaceSettingsByVideo, [activeVideoKey]: createSettingsSnapshot() }
        : workspaceSettingsByVideo,
      trackingRunsByVideo: uploadedVideo
        ? { ...trackingRunsByVideo, [activeVideoKey]: trackingRun }
        : trackingRunsByVideo,
      strategyOverride,
      corrections,
      source: 'BarnesTrack project state',
    },
    null,
    2,
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[108rem] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-muted-foreground">BarnesTrack workspace</p>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold">Barnes Maze Review</h1>
              <span className="text-sm text-muted-foreground">Video annotation and trial export</span>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            <input
              accept="video/mp4,video/*"
              className="sr-only"
              multiple
              onChange={(event) => {
                if (event.target.files) loadVideos(event.target.files);
                event.currentTarget.value = '';
              }}
              ref={fileInputRef}
              type="file"
            />
            <input
              accept="video/mp4,video/*"
              className="sr-only"
              multiple
              onChange={(event) => {
                if (event.target.files) loadVideos(event.target.files);
                event.currentTarget.value = '';
              }}
              ref={(node) => {
                folderInputRef.current = node;
                node?.setAttribute('webkitdirectory', '');
              }}
              type="file"
            />
            <input
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) loadProject(file);
                event.currentTarget.value = '';
              }}
              ref={projectInputRef}
              type="file"
            />
            <button
              aria-label="Drop videos here or select video files"
              className={`header-dropzone ${isHeaderDropTarget ? 'active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsHeaderDropTarget(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsHeaderDropTarget(false);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setIsHeaderDropTarget(false);
                loadVideos(event.dataTransfer.files);
              }}
              type="button"
            >
              <Upload aria-hidden="true" size={18} />
              <span>
                <strong>{isHeaderDropTarget ? 'Drop to add videos' : 'Drop videos here'}</strong>
                <small>or browse files</small>
              </span>
            </button>
            <button
              className="tool-button"
              onClick={() => folderInputRef.current?.click()}
              type="button"
            >
              <FolderOpen size={16} aria-hidden="true" />
              Add folder
            </button>
            <button
              className="tool-button"
              onClick={() => projectInputRef.current?.click()}
              type="button"
            >
              <FileJson size={16} aria-hidden="true" />
              Open project
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[108rem] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_220px]">
        <section className="panel overflow-hidden">
          <div className="panel-heading">
            <div>
              <h2>{uploadedVideo ? 'Local trial review' : selected.label}</h2>
              <span>
                {activeLabel} · frame {currentFrame + 1} / {totalFrames.toLocaleString()} ·{' '}
                {formatSeconds(activeDuration)}
              </span>
            </div>
            <div className="icon-strip" aria-label="Video tools">
              <button aria-label="Reset annotations" onClick={resetRoi} type="button">
                <RotateCcw size={16} />
              </button>
              <button aria-label="Save corrections" onClick={saveCurrentFrame} type="button">
                <Save size={16} />
              </button>
              <button
                aria-label="Export project JSON"
                onClick={() =>
                  download(
                    projectJson,
                    `${activeVideoKey.replaceAll(':', '-')}-barnestrack-project.json`,
                    'application/json',
                  )
                }
                type="button"
              >
                <FileJson size={16} />
              </button>
            </div>
          </div>

          <div
            className="trial-strip"
            aria-label="Session videos"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              loadVideos(event.dataTransfer.files);
            }}
          >
            {uploadedVideos.map((video) => {
              const result = sessionResultsWithCurrentSettings[`local:${video.id}`];
              return (
                <button
                  aria-label={`Select local video ${video.name}`}
                  className={`trial-card local ${video.id === activeUploadedVideoId ? 'active' : ''}`}
                  key={video.id}
                  onClick={() => selectUploadedVideo(video)}
                  type="button"
                >
                  <span className="local-video-icon">
                    <Play size={16} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{video.name}</strong>
                    <small>
                      {result
                        ? `${result.status} · ${result.framesProcessed.toLocaleString()} frames`
                        : video.durationSeconds > 0
                          ? `local MP4 · ${formatSeconds(video.durationSeconds)}`
                          : 'local MP4 · metadata pending'}
                    </small>
                  </span>
                </button>
              );
            })}
            {uploadedVideos.length === 0
              ? samples.map((sample) => (
                  <button
                    aria-label={`Select ${sample.fileName}`}
                    className={`trial-card ${sample.id === selected.id ? 'active' : ''}`}
                    key={sample.id}
                    onClick={() => selectSample(sample)}
                    type="button"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" src={sample.frame} />
                    <span>
                      <strong>{sample.fileName}</strong>
                      <small>
                        {sample.frames.toLocaleString()} frames · {formatSeconds(sample.durationSeconds)}
                      </small>
                    </span>
                  </button>
                ))
              : null}
            <div className="status-strip" aria-label="Workflow status">
              {statuses.map((status) => (
                <span className={status.tone} key={status.name}>
                  {status.name}: {status.value}
                </span>
              ))}
            </div>
            {projectNotice ? <small className="session-notice">{projectNotice}</small> : null}
          </div>

          <div className="frame-status-strip" aria-label="Frame review status">
            <section className="frame-status-card">
              <div className="frame-status-heading">
                <h3>
                  Current frame
                  <SectionInfo
                    label="Current frame"
                    placement="right"
                    items={[
                      'Shows the active frame and its saved annotation state.',
                      'Body and nose coordinates update as you drag nodes.',
                    ]}
                  />
                </h3>
                <span>{frameAnnotation.touched ? 'saved' : 'draft'}</span>
              </div>
              {selectedSkeleton ? (
                <p>
                  {displayAnimalLabel(selectedSkeleton.label)} · Body {Math.round(selectedSkeleton.body.x)},{' '}
                  {Math.round(selectedSkeleton.body.y)} · Nose {Math.round(selectedSkeleton.nose.x)},{' '}
                  {Math.round(selectedSkeleton.nose.y)}
                </p>
              ) : (
                <p>No animal selected</p>
              )}
              <small>
                Frame events {events.length} · saved frames {savedFrameCount}
              </small>
            </section>

            <section className={`frame-status-card ${frameAnalysis.status}`}>
              <div className="frame-status-heading">
                <h3>
                  {frameAnalysis.status === 'ready'
                    ? `${Math.round(frameAnalysis.confidence * 100)}% draft confidence`
                    : frameAnalysis.status === 'error'
                      ? 'Analysis needs review'
                      : 'Frame analysis idle'}
                  <SectionInfo
                    label="Frame analysis"
                    items={[
                      'Analyzes only the displayed frame.',
                      'Use it to inspect a draft before tracking a full range.',
                    ]}
                  />
                </h3>
              </div>
              <p>{frameAnalysis.message}</p>
              {frameAnalysis.status === 'ready' ? (
                <small>
                  Component {frameAnalysis.componentPixels} px / dark field{' '}
                  {frameAnalysis.darkPixels} px
                </small>
              ) : null}
              <button className="analysis-button" onClick={analyzeCurrentFrame} type="button">
                Analyze frame
              </button>
            </section>

            <section className={`frame-status-card ${trackingRun.status}`}>
              <div className="frame-status-heading">
                <h3>
                  {trackingRun.status === 'running'
                    ? `${Math.round(trackingPercent)}% complete`
                    : trackingRun.status === 'done'
                      ? `${trackingRun.saved} frames saved`
                      : trackingRun.status === 'error'
                        ? 'Tracking needs review'
                        : 'Tracking idle'}
                  <SectionInfo
                    label="Tracking"
                    items={[
                      'Track full processes the remaining video.',
                      'Next 60 is a short validation pass.',
                      'Flags identify uncertain or missing detections for review.',
                    ]}
                  />
                </h3>
              </div>
              <progress
                aria-label="Tracking progress"
                className="tracking-progress"
                max={trackingRun.total || 100}
                value={trackingRun.processed}
              >
                {Math.round(trackingPercent)}%
              </progress>
              <small>
                {trackingRun.processed} / {trackingRun.total || 0} frames · {trackingRun.saved}{' '}
                saved
              </small>
              <p>{trackingRun.message}</p>
              <div className="tracking-actions">
                {trackingRun.status === 'running' ? (
                  <button className="tracking-stop" onClick={stopTracking} type="button">
                    Stop
                  </button>
                ) : (
                  <>
                    <button disabled={!uploadedVideo} onClick={trackFullVideo} type="button">
                      Track full
                    </button>
                    <button disabled={!uploadedVideo} onClick={trackNextFrames} type="button">
                      Next 60
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="frame-status-card">
              <div className="frame-status-heading">
                <h3>
                  Review queue
                  <SectionInfo
                    label="Review queue"
                    placement="left"
                    items={[
                      'Groups adjacent flagged frames into review ranges.',
                      'Open Flags to jump, correct, review, or clear ranges.',
                    ]}
                  />
                </h3>
                <span>
                  {openReviewGroups.length} {openReviewGroups.length === 1 ? 'range' : 'ranges'}
                </span>
              </div>
              <p>
                {reviewFlags.length > 0
                  ? `${openReviewFlags.length} flagged frames in ${openReviewGroups.length} review ranges`
                  : 'No flagged frames'}
              </p>
              <small>Open Flagged frames to review a range, not every individual frame.</small>
            </section>
          </div>

          <div className="canvas-workspace">
            <aside className="canvas-dock canvas-dock-left" aria-label="Overlay tools and layers">
              <div className="dock-section">
                <h3>
                  Tools
                  <SectionInfo
                    label="Tools"
                    placement="right"
                    items={[
                      'Nose / Body drags each node independently.',
                      'Maze and Well align the arena geometry.',
                      'Visit and Escape add manual behavior events.',
                    ]}
                  />
                </h3>
                <div className="tool-palette vertical" aria-label="Annotation tools">
                  {toolModes.map((tool) => (
                    <button
                      className={toolMode === tool.id ? 'active' : ''}
                      key={tool.id}
                      onClick={() => setToolMode(tool.id)}
                      type="button"
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="dock-section">
                <h3>
                  Layers
                  <SectionInfo
                    label="Layers"
                    placement="right"
                    items={[
                      'Toggle overlay visibility without changing stored data.',
                      'Hide trajectory or events to inspect the raw video.',
                    ]}
                  />
                </h3>
                <div className="layer-list">
                  {([
                    ['maze', 'Platform'],
                    ['wells', 'Wells'],
                    ['skeletons', 'Animals / Skeleton'],
                    ['trajectory', 'Trajectory'],
                    ['events', 'Events'],
                  ] as Array<[keyof LayerVisibility, string]>).map(([layer, label]) => (
                    <label key={layer}>
                      <input
                        checked={layers[layer]}
                        onChange={() => toggleLayer(layer)}
                        type="checkbox"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </aside>

            <div className="canvas-center">
              <div className={`video-stage annotation-mode-${toolMode}`} ref={stageRef}>
                {uploadedVideo ? (
                  <video
                    aria-label={`Loaded video ${uploadedVideo.name}`}
                    muted
                    onEnded={() => setIsPlaying(false)}
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      if (!uploadedVideo) return;
                      setUploadedVideos((current) =>
                        current.map((candidate) =>
                          candidate.id === uploadedVideo.id
                            ? {
                                ...candidate,
                                durationSeconds: video.duration,
                                width: video.videoWidth || 640,
                                height: video.videoHeight || 480,
                              }
                            : candidate,
                        ),
                      );
                    }}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => {
                      expectedSeekFrameRef.current = null;
                      setIsPlaying(true);
                    }}
                    onSeeked={(event) => syncRenderedVideoTime(event.currentTarget.currentTime)}
                    onTimeUpdate={(event) =>
                      syncRenderedVideoTime(event.currentTarget.currentTime)
                    }
                    ref={videoRef}
                    src={uploadedVideo.url}
                  />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`Representative frame from ${selected.fileName}`}
                      ref={frameImageRef}
                      src={selected.frame}
                    />
                  </>
                )}
                <svg
                  aria-label="Annotation overlay"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  viewBox="0 0 640 480"
                >
                  {layers.maze ? (
                    <>
                      <circle
                        className="platform-ring"
                        cx={platform.x}
                        cy={platform.y}
                        r={platform.r}
                      />
                      <circle className="platform-handle" cx={platform.x} cy={platform.y} r="5" />
                    </>
                  ) : null}
                  {layers.wells
                    ? holes.map((hole) => (
                        <g
                          className={hole.id === selectedWellId ? 'hole-group selected' : 'hole-group'}
                          key={hole.id}
                        >
                          <circle className="hit-area" cx={hole.x} cy={hole.y} r={hole.radius + 7} />
                          <circle
                            className={hole.id === targetHole ? 'target-hole' : 'hole-marker'}
                            cx={hole.x}
                            cy={hole.y}
                            r={hole.radius * 0.7}
                          />
                          <text x={hole.x + 9} y={hole.y + 3}>
                            {hole.id}
                          </text>
                        </g>
                      ))
                    : null}
                  {layers.trajectory
                    ? trajectoryPaths.map((path, index) => (
                        <polyline className="trajectory-path" key={`${index}-${path.slice(0, 20)}`} points={path} />
                      ))
                    : null}
                  {layers.skeletons
                    ? (
                      <>
                        {skeletons.map((skeleton) => (
                        <g
                          className={
                            skeleton.id === selectedSkeletonId
                              ? 'skeleton selected'
                              : 'skeleton'
                          }
                          key={skeleton.id}
                        >
                          <line
                            className="nose-vector"
                            x1={skeleton.body.x}
                            x2={skeleton.nose.x}
                            y1={skeleton.body.y}
                            y2={skeleton.nose.y}
                          />
                          <circle className="hit-area" cx={skeleton.body.x} cy={skeleton.body.y} r="13" />
                          <circle className="body-point" cx={skeleton.body.x} cy={skeleton.body.y} r="5" />
                          <circle className="hit-area" cx={skeleton.nose.x} cy={skeleton.nose.y} r="11" />
                          <circle className="nose-point" cx={skeleton.nose.x} cy={skeleton.nose.y} r="4" />
                        </g>
                        ))}
                      </>
                    )
                    : null}
                  {layers.events
                    ? activeEventPins.map((event) => {
                        const hole = holes.find((candidate) => candidate.id === event.hole);
                        if (!hole) return null;
                        return (
                          <g
                            className={`event-pin ${event.type}`}
                            key={event.id}
                          >
                            <Crosshair x={hole.x - 5} y={hole.y - 5} size={10} />
                          </g>
                        );
                      })
                    : null}
                </svg>
              </div>

              <div className="overlay-legend" aria-label="Overlay legend">
                <span><i className="legend-body" /> Body point</span>
                <span><i className="legend-nose" /> Nose proxy</span>
                <span><i className="legend-target" /> Target well</span>
              </div>

              <div className="playback-controls" aria-label="Video playback controls">
                <div className="frame-controls">
                  <button aria-label="Previous frame" onClick={() => stepFrame(-1)} type="button">
                    <ChevronLeft size={17} aria-hidden="true" />
                    Prev
                  </button>
                  <button aria-label="Play or pause" onClick={togglePlayback} type="button">
                    {isPlaying ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button aria-label="Next frame" onClick={() => stepFrame(1)} type="button">
                    Next
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                  <label className="jump-frame-control">
                    <span>Frame</span>
                    <input
                      max={totalFrames}
                      min="1"
                      onChange={(event) => seekToFrame(Number(event.target.value) - 1)}
                      type="number"
                      value={currentFrame + 1}
                    />
                  </label>
                  <output className="frame-count-readout">
                    {totalFrames.toLocaleString()} frames
                  </output>
                  <label className="fps-control">
                    <span>FPS</span>
                    <input
                      max="120"
                      min="1"
                      onChange={(event) => setFps(Number(event.target.value))}
                      step="0.001"
                      type="number"
                      value={Number(fps.toFixed(3))}
                    />
                  </label>
                </div>

                <label className="scrub-control">
                  <span>
                    {currentTime.toFixed(2)} s / {activeDuration.toFixed(2)} s
                  </span>
                  <input
                    aria-label="Video time"
                    max={activeDuration || 0}
                    min="0"
                    onChange={(event) => {
                      const time = Number(event.target.value);
                      const frame = clamp(Math.round(time * fps), 0, totalFrames - 1);
                      setCurrentTime(time);
                      setCurrentFrameIndex(frame);
                      expectedSeekFrameRef.current = frame;
                      if (videoRef.current) videoRef.current.currentTime = time;
                    }}
                    step={1 / fps}
                    type="range"
                    value={Math.min(currentTime, activeDuration || 0)}
                  />
                </label>
              </div>
            </div>

            <aside className="canvas-dock canvas-dock-right" aria-label="Overlay object lists">
              <div className="object-panel">
                <div className="object-tabs" role="tablist" aria-label="Overlay objects">
                  {([
                    ['mice', `Animals ${skeletons.length}`],
                    ['wells', `Wells ${holes.length}`],
                    ['events', `Events ${eventLog.length}`],
                    ['flagged', `Flags ${openReviewGroups.length}`],
                  ] as Array<[ObjectPanelTab, string]>).map(([tab, label]) => (
                    <button
                      aria-selected={objectPanelTab === tab}
                      className={objectPanelTab === tab ? 'active' : ''}
                      key={tab}
                      onClick={() => setObjectPanelTab(tab)}
                      role="tab"
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {objectPanelTab === 'mice' ? (
                  <section className="object-tab-panel" role="tabpanel">
                    <div className="object-panel-heading">
                      <h3>
                        Animals / Skeleton
                        <SectionInfo
                          label="Animals"
                          placement="left"
                          items={[
                            'Each animal has one body node and one nose node.',
                            'Add or remove animals for recordings with multiple subjects.',
                            'Use Nose / Body to manually correct either node.',
                          ]}
                        />
                      </h3>
                      <div className="object-panel-actions">
                        <button onClick={() => addSkeleton()} type="button">
                          Add
                        </button>
                        <button
                          disabled={!selectedSkeleton}
                          onClick={removeSelectedSkeleton}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                      <button
                        className="object-clear-button"
                        disabled={skeletons.length === 0 && events.length === 0}
                        onClick={clearCurrentFrame}
                        type="button"
                      >
                        Clear frame
                      </button>
                    </div>
                    <div className="object-tree">
                      {skeletons.map((skeleton) => (
                        <button
                          className={skeleton.id === selectedSkeletonId ? 'active' : ''}
                          key={skeleton.id}
                          onClick={() => selectSkeleton(skeleton.id)}
                          type="button"
                        >
                            <strong>{displayAnimalLabel(skeleton.label)}</strong>
                          <span>
                            Body {Math.round(skeleton.body.x)}, {Math.round(skeleton.body.y)}
                          </span>
                          <span>
                            Nose {Math.round(skeleton.nose.x)}, {Math.round(skeleton.nose.y)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {objectPanelTab === 'wells' ? (
                  <section className="object-tab-panel" role="tabpanel">
                    <div className="object-panel-heading">
                      <h3>
                        Wells
                        <SectionInfo
                          label="Wells"
                          placement="left"
                          items={[
                            'Wells are editable circular regions used for visit events.',
                            'Add or remove wells to match the apparatus.',
                            'Changing radius changes the visit area for that well.',
                          ]}
                        />
                      </h3>
                      <div className="object-panel-actions">
                        <button onClick={addWell} type="button">
                          Add
                        </button>
                        <button
                          disabled={!selectedWell || holes.length <= 1}
                          onClick={removeSelectedWell}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <label className="object-range-control">
                      <span>
                        Selected radius
                        <strong>{selectedWell ? `${Math.round(selectedWell.radius)} px` : 'None'}</strong>
                      </span>
                      <input
                        disabled={!selectedWell}
                        max="28"
                        min="4"
                        onChange={(event) => updateSelectedWellRadius(Number(event.target.value))}
                        type="range"
                        value={selectedWell?.radius ?? 10}
                      />
                    </label>
                    <div className="object-tree">
                      {holes.map((hole) => (
                        <button
                          className={hole.id === selectedWellId ? 'active' : ''}
                          key={hole.id}
                          onClick={() => setSelectedWellId(hole.id)}
                          type="button"
                        >
                          <strong>Well {hole.id}</strong>
                          <span>
                            X {Math.round(hole.x)}, Y {Math.round(hole.y)}
                          </span>
                          <span>Radius {Math.round(hole.radius)} px</span>
                          <span>{hole.id === targetHole ? 'Target well' : 'Editable well'}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {objectPanelTab === 'events' ? (
                  <section className="object-tab-panel" role="tabpanel">
                    <div className="object-panel-heading compact">
                      <h3>
                        Events
                        <SectionInfo
                          label="Events"
                          placement="left"
                          items={[
                            'Visits are derived from nose position and dwell time.',
                            'Escape can be added manually after visual confirmation.',
                            'Select an event to jump to its first frame.',
                          ]}
                        />
                      </h3>
                      <span>{eventLog.length} detected</span>
                    </div>
                    <div className="object-tree">
                      {eventLog.length > 0 ? (
                        eventLog.map((event) => (
                          <button
                            className={
                              currentFrame >= event.startFrame && currentFrame <= event.endFrame
                                ? 'active'
                                : ''
                            }
                            key={event.id}
                            onClick={() => seekToFrame(event.startFrame)}
                            type="button"
                          >
                            <strong>
                              {event.type === 'escape'
                                ? event.source === 'auto'
                                  ? 'Possible escape'
                                  : 'Escape'
                                : 'Visit'}{' '}
                              · Well {event.hole}
                            </strong>
                            <span>
                              Frame {event.startFrame + 1} · {formatSeconds(event.timeSeconds)}
                            </span>
                            <span>
                              {event.type === 'escape' && event.source === 'auto'
                                ? `Open no-detection run · ${event.durationSeconds.toFixed(2)} s · ${Math.round(event.confidence * 100)}%`
                                : `${event.source} · ${event.durationSeconds.toFixed(2)} s · ${Math.round(event.confidence * 100)}%`}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p>No events yet</p>
                      )}
                    </div>
                  </section>
                ) : null}

                {objectPanelTab === 'flagged' ? (
                  <section className="object-tab-panel" role="tabpanel">
                    <div className="object-panel-heading compact">
                      <h3>
                        Review ranges
                        <SectionInfo
                          label="Review ranges"
                          placement="left"
                          items={[
                            'Ranges combine adjacent low-confidence or no-detection frames.',
                            'Select a range to inspect and correct its start frame.',
                            'Clear all flags removes review markers, not annotations.',
                          ]}
                        />
                      </h3>
                      <span>{openReviewGroups.length} open · {openReviewFlags.length} frames</span>
                    </div>
                    {openReviewGroups.length > 0 ? (
                      <button
                        className="object-clear-button"
                        onClick={clearAllReviewFlags}
                        type="button"
                      >
                        Clear all flags
                      </button>
                    ) : null}
                    {currentReviewGroup ? (
                      <button
                        className="object-clear-button"
                        onClick={unflagCurrentReviewGroupAndAdvance}
                        type="button"
                      >
                        Mark range reviewed &amp; next
                      </button>
                    ) : (
                      <p className="object-panel-note">
                        Select a review range, inspect its start and end, then mark the range reviewed.
                      </p>
                    )}
                    <div className="object-tree">
                      {openReviewGroups.length > 0 ? (
                        openReviewGroups.map((group) => (
                          <button
                            className={
                              currentFrame >= group.startFrame && currentFrame <= group.endFrame
                                ? 'active'
                                : ''
                            }
                            key={`${group.reason}-${group.startFrame}-${group.endFrame}`}
                            onClick={() => seekToFrame(group.startFrame)}
                            type="button"
                          >
                            <strong>
                              {group.startFrame === group.endFrame
                                ? `Frame ${group.startFrame + 1}`
                                : `Frames ${group.startFrame + 1}-${group.endFrame + 1}`}
                            </strong>
                            <span>{group.reason.replace('-', ' ')}</span>
                            <span>
                              {group.flags.length} frames · {Math.round(group.confidence * 100)}% confidence
                            </span>
                          </button>
                        ))
                      ) : (
                        <p>No review ranges remain.</p>
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            </aside>
          </div>

          <details className="settings-presets collapsible-section" open>
            <summary className="collapsible-summary">
              <span>Settings presets</span>
              <SectionInfo
                label="Settings presets"
                items={[
                  'Load restores saved maze, event, and cleanup settings.',
                  'Save overwrites the preset with the current settings.',
                  'Presets never change annotations or exported results.',
                ]}
              />
              <small>
                {activeSettingsPresetId
                  ? `Preset ${activeSettingsPresetId} active`
                  : 'Saved locally'}
              </small>
            </summary>
            <div className="settings-preset-slots">
              {settingsPresets.map((preset) => (
                <div
                  className={`settings-preset-slot ${activeSettingsPresetId === preset.id ? 'active' : ''}`}
                  key={preset.id}
                >
                  <div>
                    <strong>Preset {preset.id}</strong>
                    <span>
                      {preset.settings
                        ? `${preset.settings.holes.length} wells · ${Math.round(
                            preset.settings.holes.reduce((sum, hole) => sum + hole.radius, 0) /
                              Math.max(1, preset.settings.holes.length),
                          )} px`
                        : 'Empty'}
                    </span>
                  </div>
                  <div className="settings-preset-actions">
                    <button
                      disabled={!preset.settings}
                      onClick={() => loadSettingsPreset(preset.id)}
                      type="button"
                    >
                      Load
                    </button>
                    <button
                      aria-label={`Save current settings to preset ${preset.id}`}
                      className="icon-button"
                      onClick={() => saveSettingsPreset(preset.id)}
                      title={`Save current settings to preset ${preset.id}`}
                      type="button"
                    >
                      <Save size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </details>

          <div className="settings-groups">
            <details className="settings-group" open>
              <summary>
                <span>Event detection</span>
                <SectionInfo
                  label="Event detection"
                  items={[
                    'Target well defines the success and escape reference.',
                    'Higher dwell requires a longer visit before it is logged.',
                    'Larger nose distance makes a well visit easier to detect.',
                  ]}
                />
                <small>Target well, dwell, and nose threshold</small>
              </summary>
              <div className="settings-group-content grid gap-3 md:grid-cols-3">
                <label className="control">
                  <span>Target well</span>
                  <select value={targetHole} onChange={(event) => setTargetHole(Number(event.target.value))}>
                    {holes.map((hole) => (
                      <option key={hole.id} value={hole.id}>
                        Well {hole.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="control">
                  <span>Dwell threshold: {dwell.toFixed(1)} s</span>
                  <input
                    max="2"
                    min="0.1"
                    onChange={(event) => setDwell(Number(event.target.value))}
                    step="0.1"
                    type="range"
                    value={dwell}
                  />
                </label>
                <label className="control">
                  <span>Nose proxy distance: {distance.toFixed(1)} cm</span>
                  <input
                    max="4"
                    min="0.5"
                    onChange={(event) => setDistance(Number(event.target.value))}
                    step="0.1"
                    type="range"
                    value={distance}
                  />
                </label>
              </div>
            </details>

            <details className="settings-group" open>
              <summary>
                <span>Maze geometry</span>
                <SectionInfo
                  label="Maze geometry"
                  items={[
                    'Platform diameter converts tracked pixels into cm metrics.',
                    'Well size changes the visit area for every well.',
                    'X, Y, radius, ring, and rotation align the ROI to the video.',
                    'Geometry changes can alter tracking and event results.',
                  ]}
                />
                <small>Platform, well size, placement, and rotation</small>
              </summary>
              <div className="settings-group-content grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="control">
                  <span>Platform diameter: {platformDiameterCm.toFixed(0)} cm</span>
                  <input
                    max="140"
                    min="50"
                    onChange={(event) => setPlatformDiameterCm(Number(event.target.value))}
                    step="1"
                    type="range"
                    value={platformDiameterCm}
                  />
                </label>
                <label className="control">
                  <span>Well size (all): {allWellRadius} px</span>
                  <input
                    max="28"
                    min="4"
                    onChange={(event) => updateAllWellRadii(Number(event.target.value))}
                    type="range"
                    value={allWellRadius}
                  />
                </label>
                <label className="control compact">
                  <span>Platform X: {platform.x}px</span>
                  <input
                    max="640"
                    min="0"
                    onChange={(event) => updatePlatform('x', Number(event.target.value))}
                    type="range"
                    value={platform.x}
                  />
                </label>
                <label className="control compact">
                  <span>Platform Y: {platform.y}px</span>
                  <input
                    max="480"
                    min="0"
                    onChange={(event) => updatePlatform('y', Number(event.target.value))}
                    type="range"
                    value={platform.y}
                  />
                </label>
                <label className="control compact">
                  <span>Radius: {platform.r}px</span>
                  <input
                    max="240"
                    min="120"
                    onChange={(event) => updatePlatform('r', Number(event.target.value))}
                    type="range"
                    value={platform.r}
                  />
                </label>
                <label className="control compact">
                  <span>Hole ring: {holeScale.toFixed(2)}</span>
                  <input
                    max="1.05"
                    min="0.7"
                    onChange={(event) =>
                      updateHoleTemplate(Number(event.target.value), rotationDegrees)
                    }
                    step="0.01"
                    type="range"
                    value={holeScale}
                  />
                </label>
                <label className="control compact">
                  <span>Rotation: {rotationDegrees} deg</span>
                  <input
                    max="180"
                    min="-180"
                    onChange={(event) =>
                      updateHoleTemplate(holeScale, Number(event.target.value))
                    }
                    type="range"
                    value={rotationDegrees}
                  />
                </label>
              </div>
            </details>

            <details className="settings-group" open>
              <summary>
                <span>Trajectory cleanup</span>
                <SectionInfo
                  label="Trajectory cleanup"
                  items={[
                    'Smoothing reduces jitter but can soften sharp turns.',
                    'Gap fill connects brief missing runs without changing raw points.',
                    'Lower outlier jump rejects more large frame-to-frame moves.',
                  ]}
                />
                <small>Applies to derived path metrics; raw annotations stay unchanged</small>
              </summary>
              <div className="settings-group-content grid gap-3 md:grid-cols-3">
                <label className="control">
                  <span>Smoothing: {smoothingWindow === 0 ? 'Off' : `${smoothingWindow}-frame window`}</span>
                  <input
                    max="4"
                    min="0"
                    onChange={(event) => setSmoothingWindow(Number(event.target.value))}
                    type="range"
                    value={smoothingWindow}
                  />
                </label>
                <label className="control">
                  <span>Gap fill: {maxGapFrames === 0 ? 'Off' : `up to ${maxGapFrames} frames`}</span>
                  <input
                    max="12"
                    min="0"
                    onChange={(event) => setMaxGapFrames(Number(event.target.value))}
                    type="range"
                    value={maxGapFrames}
                  />
                </label>
                <label className="control">
                  <span>Outlier jump: {outlierDistancePx} px</span>
                  <input
                    max="180"
                    min="20"
                    onChange={(event) => setOutlierDistancePx(Number(event.target.value))}
                    step="5"
                    type="range"
                    value={outlierDistancePx}
                  />
                </label>
              </div>
            </details>
          </div>
          <p className="roi-note">
            <MousePointer2 size={14} aria-hidden="true" />
            Choose a tool, then click or drag directly on the overlay. Nose / Body lets you
            drag each node independently. Left/right arrow
            keys step by frame; space toggles playback.
          </p>
          <canvas
            aria-hidden="true"
            className="analysis-canvas"
            height="480"
            ref={analysisCanvasRef}
            width="640"
          />

          <details className="results-section collapsible-section" open>
            <summary className="collapsible-summary">
              <span>
                Results
                <SectionInfo
                  label="Results"
                  items={[
                    'Metrics are derived from the current annotations and settings.',
                    'Review open flags before treating values as final.',
                    'Changing Search strategy updates only the behavior label.',
                  ]}
                />
              </span>
              <small>{eventLog.length > 0 ? 'event-derived' : 'pending'}</small>
            </summary>

            <div className="results-grid">
              <div className="metric-grid">
                <Metric
                  label="Primary latency"
                  value={derivedPrimaryLatency !== null ? `${derivedPrimaryLatency.toFixed(1)} s` : 'Not generated'}
                />
                <Metric
                  label="Total latency"
                  value={derivedTotalLatency !== null ? `${derivedTotalLatency.toFixed(1)} s` : 'Not generated'}
                />
                <Metric
                  label="Primary errors"
                  value={hasDerivedResults ? String(primaryErrors) : 'Not generated'}
                />
                <Metric
                  label="Total errors"
                  value={hasDerivedResults ? String(adjustedErrors) : 'Not generated'}
                />
                <Metric label="Events" value={String(eventLog.length)} />
                <Metric
                  label="Path length"
                  value={derivedPathCm !== null ? `${derivedPathCm.toFixed(1)} cm` : 'Not generated'}
                />
                <Metric
                  label="Speed"
                  value={derivedSpeedCms !== null ? `${derivedSpeedCms.toFixed(2)} cm/s` : 'Not generated'}
                />
                <Metric
                  label="Target quadrant"
                  value={
                    derivedTargetQuadrantPct !== null
                      ? `${derivedTargetQuadrantPct.toFixed(1)}%`
                      : 'Not generated'
                  }
                />
              </div>

              <div className="result-notes">
                <div className="quality-box">
                  <div>
                    <CircleDot size={18} aria-hidden="true" />
                    <strong>
                      {processedPercent !== null
                        ? `${processedPercent.toFixed(1)}% frames processed`
                        : 'Tracking not run'}
                    </strong>
                  </div>
                  <p>
                    {hasTrackingSummary
                      ? `${highConfidenceAnnotations} high-confidence drafts · ${lowConfidenceFlags} low-confidence · ${noDetectionFlags} no detection · ${openReviewFlags.length} flags open.`
                      : 'Run Track full or Next 60 to generate tracking results.'}
                  </p>
                </div>

                {reviewFlags.length > 0 ? (
                  <div className="warning-box">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <p>Review flagged frames before treating exported metrics as final.</p>
                  </div>
                ) : null}

              </div>
            </div>

            <div className="quality-visualizations">
              <section className="quality-plot">
                <div className="quality-plot-heading">
                  <strong>Tracking quality</strong>
                  <span>{reviewGroups.length} ranges · {reviewFlags.length} frames</span>
                </div>
                <div className="quality-timeline" aria-label="Flagged frame distribution">
                  {reviewGroups.map((group) => (
                    <button
                      aria-label={`Jump to review range ${group.startFrame + 1}-${group.endFrame + 1}: ${group.reason}`}
                      className={`quality-flag ${group.reason} ${group.flags.every((flag) => flag.reviewed) ? 'reviewed' : ''}`}
                      key={`${group.startFrame}-${group.endFrame}-${group.reason}`}
                      onClick={() => seekToFrame(group.startFrame)}
                      style={{ left: `${(group.startFrame / Math.max(1, totalFrames - 1)) * 100}%` }}
                      type="button"
                    />
                  ))}
                </div>
                <small>Each marker is a clickable review range. Orange means low confidence; red means no detection.</small>
              </section>
              <section className="quality-plot">
                <div className="quality-plot-heading">
                  <strong>Occupancy</strong>
                  <span>{validTrajectory.length} tracked frames</span>
                </div>
                <svg aria-label="Trajectory occupancy heat map" className="occupancy-map" viewBox="0 0 12 9">
                  {occupancyCells.map((cell) => (
                    <rect
                      fill="currentColor"
                      height="1"
                      key={`${cell.column}-${cell.row}`}
                      opacity={cell.opacity}
                      width="1"
                      x={cell.column}
                      y={cell.row}
                    />
                  ))}
                </svg>
                <small>Darker cells show where the saved body trajectory spent more time.</small>
              </section>
            </div>

            <div className="strategy">
              <div className="strategy-heading">
                <strong>Search strategy (behavior label)</strong>
                <select
                  aria-label="Search strategy override"
                  onChange={(event) => setStrategyOverride(event.target.value as 'auto' | SearchStrategy)}
                  value={strategyOverride}
                >
                  <option value="auto">Auto</option>
                  <option value="spatial">Spatial</option>
                  <option value="serial">Serial</option>
                  <option value="random">Random</option>
                </select>
              </div>
              <p>
                Classify the completed trial after tracking. Keep Auto for the draft suggestion,
                or choose Spatial, Serial, or Random after reviewing the video and events. This
                changes only the exported behavior label, not the numeric results.
              </p>
              <span>
                {finalStrategy
                  ? `${finalStrategy} · ${autoStrategy.reason}`
                  : autoStrategy.reason}
              </span>
            </div>

            <section className="result-export" aria-label="Export results">
              <h3>Export</h3>
              <div className="result-actions">
                <button
                  className="wide-action primary"
                  onClick={() => download(csv, 'barnestrack-trial-summary.csv', 'text/csv')}
                  type="button"
                >
                  <Download size={16} aria-hidden="true" />
                  Summary CSV
                </button>
                <button
                  className="wide-action"
                  onClick={() =>
                    downloadWorkbook(
                      [
                        { name: 'Summary', rows: parseCsv(csv) },
                        { name: 'Events', rows: parseCsv(eventCsv) },
                      ],
                      'barnestrack-trial-report.xlsx',
                    )
                  }
                  type="button"
                >
                  <Download size={16} aria-hidden="true" />
                  Trial XLSX
                </button>
                <button
                  className="wide-action"
                  disabled={Object.keys(sessionResults).length === 0}
                  onClick={() => download(cohortCsv, 'barnestrack-cohort-summary.csv', 'text/csv')}
                  type="button"
                >
                  <Download size={16} aria-hidden="true" />
                  Cohort CSV ({Object.keys(sessionResults).length})
                </button>
                <button
                  className="wide-action"
                  disabled={Object.keys(sessionResults).length === 0}
                  onClick={() =>
                    downloadWorkbook(
                      [{ name: 'Cohort summary', rows: parseCsv(cohortCsv) }],
                      'barnestrack-cohort-summary.xlsx',
                    )
                  }
                  type="button"
                >
                  <Download size={16} aria-hidden="true" />
                  Cohort XLSX ({Object.keys(sessionResults).length})
                </button>
                <button
                  className="wide-action"
                  disabled={eventLog.length === 0}
                  onClick={() => download(eventCsv, 'barnestrack-event-detail.csv', 'text/csv')}
                  type="button"
                >
                  <Download size={16} aria-hidden="true" />
                  Event CSV
                </button>
              </div>
            </section>
          </details>
        </section>

        <aside className="panel order-3 guide-panel">
          <div className="panel-heading">
            <h2>
              How to use
              <SectionInfo
                label="How to use"
                items={[
                  'Follow the steps from video setup through review and export.',
                  'Use presets to reuse calibrated settings across videos.',
                ]}
              />
            </h2>
            <span>quick workflow</span>
          </div>

          <ol className="guide-steps">
            <li>
              <strong>Start or restore a session</strong>
              <span>Drop videos in the header, browse files, or add a folder. Open project restores saved annotations after you reconnect the same files.</span>
            </li>
            <li>
              <strong>Apply or calibrate settings</strong>
              <span>Load a preset. If needed, use Maze for the platform and Well for individual wells.</span>
            </li>
            <li>
              <strong>Set target and check the overlay</strong>
              <span>Select Target, click the escape well, then use Nose / Body to drag either node on a draft point.</span>
            </li>
            <li>
              <strong>Track the trial</strong>
              <span>Use Track full for the complete video. Next 60 is a short test pass.</span>
            </li>
            <li>
              <strong>Review flagged frames</strong>
              <span>Open Flags, select a frame, correct its overlay, then choose Unflag &amp; next. An open no-detection run can appear as Possible escape; use Escape only when the animal truly enters the box.</span>
            </li>
            <li>
              <strong>Finalize and export</strong>
              <span>Export trial Summary/Event CSVs, or Cohort CSV after processing multiple videos.</span>
            </li>
          </ol>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionInfo({
  label,
  items,
  placement = 'center',
}: {
  label: string;
  items: string[];
  placement?: 'left' | 'center' | 'right';
}) {
  return (
    <button
      aria-label={`${label} help`}
      className={`section-info section-info-${placement}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      type="button"
    >
      <Info aria-hidden="true" size={15} />
      <span className="section-info-tooltip" role="tooltip">
        <strong>{label}</strong>
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </span>
    </button>
  );
}
