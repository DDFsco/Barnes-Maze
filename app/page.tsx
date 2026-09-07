'use client';

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crosshair,
  Download,
  FileJson,
  FolderOpen,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Save,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Point = { x: number; y: number };
type Platform = Point & { r: number };
type Well = Point & { id: number; radius: number };
type ToolMode =
  | 'select'
  | 'add-nodes'
  | 'move-maze'
  | 'move-hole'
  | 'target'
  | 'body'
  | 'nose'
  | 'investigation'
  | 'escape';
type ObjectPanelTab = 'mice' | 'wells' | 'events';
type SearchStrategy = 'spatial' | 'serial' | 'random';
type DragTarget =
  | { type: 'platform'; start: Point; origin: Platform }
  | { type: 'hole'; id: number }
  | { type: 'body'; skeletonId: number }
  | { type: 'nose'; skeletonId: number }
  | { type: 'skeleton'; skeletonId: number; start: Point; body: Point; nose: Point };

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

type LayerVisibility = {
  maze: boolean;
  wells: boolean;
  skeletons: boolean;
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
  name: string;
  url: string;
  durationSeconds: number;
  width: number;
  height: number;
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
    caveat: 'Mouse partly merges with the lower rim and adjacent hole.',
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
  { id: 'select', label: 'Select' },
  { id: 'add-nodes', label: 'Add nodes' },
  { id: 'move-maze', label: 'Maze' },
  { id: 'move-hole', label: 'Well' },
  { id: 'target', label: 'Target' },
  { id: 'body', label: 'Body' },
  { id: 'nose', label: 'Nose' },
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
        count: number;
      }
    | null = null;

  function closeActive() {
    if (!active) return;
    const durationFrames = active.endFrame - active.startFrame + 1;
    if (durationFrames >= minFrames) {
      const type = active.hole === targetWell ? 'escape' : 'investigation';
      autoEvents.push({
        id: `auto-${active.hole}-${active.startFrame}-${active.endFrame}`,
        type,
        source: 'auto',
        hole: active.hole,
        startFrame: active.startFrame,
        endFrame: active.endFrame,
        timeSeconds: active.startFrame / fps,
        durationSeconds: durationFrames / fps,
        confidence: active.confidenceSum / Math.max(1, active.count),
      });
    }
    active = null;
  }

  for (const { frame, annotation } of sortedFrames) {
    for (const event of annotation.events) {
      manualEvents.push({
        id: `manual-${event.type}-${event.hole}-${event.frame}`,
        type: event.type,
        source: 'manual',
        hole: event.hole,
        startFrame: event.frame,
        endFrame: event.frame,
        timeSeconds: event.frame / fps,
        durationSeconds: 0,
        confidence: 1,
      });
    }

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
    if (active !== null && active.hole === hitWell.id && frame <= active.endFrame + 1) {
      active.endFrame = frame;
      active.confidenceSum += confidence;
      active.count += 1;
      continue;
    }

    closeActive();
    active = {
      hole: hitWell.id,
      startFrame: frame,
      endFrame: frame,
      confidenceSum: confidence,
      count: 1,
    };
  }

  closeActive();
  return [...manualEvents, ...autoEvents].sort((a, b) => a.timeSeconds - b.timeSeconds);
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
    label: `Mouse ${id}`,
    body,
    nose: { x: body.x + 18, y: body.y - 14 },
  };
}

function makeFrameAnnotation(body: Point): FrameAnnotation {
  return {
    skeletons: [makeSkeleton(1, body)],
    selectedSkeletonId: 1,
    events: [],
    touched: false,
  };
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameImageRef = useRef<HTMLImageElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopTrackingRef = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState(samples[0].id);
  const [targetHole, setTargetHole] = useState(samples[0].targetHole);
  const [dwell, setDwell] = useState(0.5);
  const [distance, setDistance] = useState(1.8);
  const [platformDiameterCm, setPlatformDiameterCm] = useState(91);
  const [strategyOverride, setStrategyOverride] = useState<'auto' | SearchStrategy>('auto');
  const [corrections, setCorrections] = useState(1);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(samples[0].fpsValue);
  const [platform, setPlatform] = useState(samples[0].platform);
  const [holes, setHoles] = useState(() => buildHolePoints(samples[0].platform, 0.92));
  const [selectedWellId, setSelectedWellId] = useState(samples[0].targetHole);
  const [holeScale, setHoleScale] = useState(0.92);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [annotationStore, setAnnotationStore] = useState<AnnotationStore>({});
  const [hasLoadedLocalAnnotations, setHasLoadedLocalAnnotations] = useState(false);
  const [layers, setLayers] = useState<LayerVisibility>({
    maze: true,
    wells: true,
    skeletons: true,
    events: true,
  });
  const [frameAnalysis, setFrameAnalysis] = useState<FrameAnalysis>(initialAnalysis);
  const [trackingRun, setTrackingRun] = useState<TrackingRun>(initialTrackingRun);
  const [reviewFlagsByVideo, setReviewFlagsByVideo] = useState<ReviewFlagsByVideo>({});
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [objectPanelTab, setObjectPanelTab] = useState<ObjectPanelTab>('mice');
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);

  const selected = samples.find((sample) => sample.id === selectedId) ?? samples[0];
  const activeDuration = uploadedVideo?.durationSeconds || selected.durationSeconds;
  const activeLabel = uploadedVideo?.name ?? selected.fileName;
  const activeVideoKey = uploadedVideo ? `local:${uploadedVideo.name}` : selected.id;
  const totalFrames = Math.max(1, Math.round(activeDuration * fps));
  const currentFrame = clamp(Math.round(currentTime * fps), 0, totalFrames - 1);
  const frameKey = String(currentFrame);
  const frameAnnotation =
    annotationStore[activeVideoKey]?.[frameKey] ?? makeFrameAnnotation(selected.mouse);
  const skeletons = frameAnnotation.skeletons;
  const selectedSkeletonId = frameAnnotation.selectedSkeletonId;
  const events = frameAnnotation.events;
  const selectedWell = holes.find((hole) => hole.id === selectedWellId) ?? holes[0] ?? null;
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
  const currentReviewFlag = reviewFlags.find(
    (flag) => flag.frame === currentFrame && !flag.reviewed,
  );
  const nextOpenReviewFlag =
    openReviewFlags.find((flag) => flag.frame > currentFrame) ?? openReviewFlags[0] ?? null;
  const frameAnnotations = useMemo(
    () => annotationStore[activeVideoKey] ?? {},
    [activeVideoKey, annotationStore],
  );
  const eventLog = useMemo(
    () => detectEventLog(frameAnnotations, holes, targetHole, dwell, fps),
    [dwell, fps, frameAnnotations, holes, targetHole],
  );
  const trajectory = useMemo(
    () => buildTrajectory(frameAnnotations, fps),
    [fps, frameAnnotations],
  );
  const validTrajectory = trajectory.filter((point) => point.valid);
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
  const derivedPathCm = pathLengthCm(trajectory, pixelsPerCm);
  const trajectoryDurationSeconds =
    validTrajectory.length >= 2
      ? (validTrajectory[validTrajectory.length - 1].frame - validTrajectory[0].frame) / fps
      : null;
  const derivedSpeedCms =
    derivedPathCm !== null && trajectoryDurationSeconds !== null && trajectoryDurationSeconds > 0
      ? derivedPathCm / trajectoryDurationSeconds
      : null;
  const targetWell = holes.find((hole) => hole.id === targetHole) ?? null;
  const derivedTargetQuadrantPct = targetQuadrantPercent(trajectory, platform, targetWell);
  const autoStrategy = classifySearchStrategy(
    eventLog,
    targetHole,
    holes.length,
    primaryErrors,
    derivedTargetQuadrantPct,
  );
  const finalStrategy = strategyOverride === 'auto' ? autoStrategy.label : strategyOverride;
  const resultTrackedPercent =
    hasTrackingSummary ? (trackingRun.saved / Math.max(1, trackingRun.total)) * 100 : null;
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
        'tracked_percent',
        'manual_corrections',
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
        resultTrackedPercent !== null ? resultTrackedPercent.toFixed(1) : '',
        corrections,
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
    eventLog.length,
    finalStrategy,
    fps,
    hasDerivedResults,
    primaryErrors,
    resultTrackedPercent,
    targetHole,
  ]);
  const eventCsv = useMemo(() => {
    const rows = [
      [
        'video',
        'event_id',
        'event_type',
        'source',
        'well',
        'start_frame',
        'end_frame',
        'time_seconds',
        'duration_seconds',
        'confidence',
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
      ]),
    ];
    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  }, [activeLabel, eventLog]);

  useEffect(() => {
    return () => {
      if (uploadedVideo?.url) URL.revokeObjectURL(uploadedVideo.url);
    };
  }, [uploadedVideo?.url]);

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
                currentFrameFlag: currentReviewFlag ?? null,
              },
              quality: {
                trackedPercent: resultTrackedPercent,
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
    openReviewFlags.length,
    currentReviewFlag,
    platformDiameterCm,
    pixelsPerCm,
    primaryErrors,
    resultTrackedPercent,
    strategyOverride,
    autoStrategy.reason,
    trackingRun,
  ]);

  function selectSample(sample: SampleVideo) {
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
    setToolMode('select');
    setFrameAnalysis(initialAnalysis);
    setTrackingRun(initialTrackingRun);
    setReviewFlagsByVideo((current) => ({ ...current, [sample.id]: current[sample.id] ?? [] }));
  }

  function loadVideo(file: File) {
    const previousUrl = uploadedVideo?.url;
    const nextUrl = URL.createObjectURL(file);
    setUploadedVideo({
      name: file.name,
      url: nextUrl,
      durationSeconds: 0,
      width: 640,
      height: 480,
    });
    setCurrentTime(0);
    setIsPlaying(false);
    setStrategyOverride('auto');
    setFrameAnalysis({ ...initialAnalysis, source: 'video' });
    setTrackingRun(initialTrackingRun);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  }

  function seekToFrame(frame: number) {
    const safeFrame = clamp(frame, 0, totalFrames - 1);
    const nextTime = safeFrame / fps;
    setFrameAnalysis({ ...initialAnalysis, source: uploadedVideo ? 'video' : 'sample' });
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
      const baseAnnotation = currentVideoAnnotations[frameKey] ?? makeFrameAnnotation(selected.mouse);
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
    }));
  }

  function updateSkeletonPair(skeletonId: number, body: Point, nose: Point) {
    updateFrameAnnotation((annotation) => ({
      ...annotation,
      skeletons: annotation.skeletons.map((skeleton) =>
        skeleton.id === skeletonId ? { ...skeleton, body, nose } : skeleton,
      ),
      selectedSkeletonId: skeletonId,
    }));
  }

  function addSkeleton(point = { x: 320, y: 240 }) {
    const nextId = Math.max(0, ...skeletons.map((skeleton) => skeleton.id)) + 1;
    const nextSkeleton = makeSkeleton(nextId, point);
    updateFrameAnnotation((annotation) => ({
      ...annotation,
      skeletons: [...annotation.skeletons, nextSkeleton],
      selectedSkeletonId: nextId,
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
    updateFrameAnnotation((annotation) => ({ ...annotation }));
    setCorrections((value) => value + 1);
  }

  function clearCurrentFrame() {
    updateFrameAnnotation((annotation) => ({
      ...annotation,
      skeletons: [],
      selectedSkeletonId: 0,
      events: [],
    }));
    setCorrections((value) => value + 1);
  }

  function nearestHoleDistance(point: Point) {
    return holes.reduce((nearest, hole) => {
      const distanceToHole = Math.hypot(hole.x - point.x, hole.y - point.y);
      return Math.min(nearest, distanceToHole);
    }, Infinity);
  }

  function analyzeImageData(imageData: ImageData): FrameAnalysis {
    const { data, width, height } = imageData;
    const insideRoi = new Uint8Array(width * height);
    const candidates = new Uint8Array(width * height);
    let luminanceSum = 0;
    let luminanceSquaredSum = 0;
    let roiPixels = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const platformDistance = Math.hypot(x - platform.x, y - platform.y);
        const holeDistance = nearestHoleDistance({ x, y });
        const isInsidePlatform = platformDistance < platform.r * 0.95;
        const isAwayFromHole = holeDistance > 13;
        if (!isInsidePlatform || !isAwayFromHole) continue;
        const offset = (y * width + x) * 4;
        const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
        const index = y * width + x;
        insideRoi[index] = 1;
        luminanceSum += luminance;
        luminanceSquaredSum += luminance * luminance;
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

    const mean = luminanceSum / roiPixels;
    const variance = luminanceSquaredSum / roiPixels - mean * mean;
    const standardDeviation = Math.sqrt(Math.max(variance, 0));
    const threshold = Math.max(15, Math.min(115, mean - standardDeviation * 0.75));
    let darkPixels = 0;

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (!insideRoi[index]) continue;
        const offset = index * 4;
        const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
        if (luminance < threshold) {
          candidates[index] = 1;
          darkPixels += 1;
        }
      }
    }

    const visited = new Uint8Array(width * height);
    let bestComponent: {
      pixels: number;
      sumX: number;
      sumY: number;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    } | null = null;

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const startIndex = y * width + x;
        if (!candidates[startIndex] || visited[startIndex]) continue;

        const stack = [startIndex];
        visited[startIndex] = 1;
        let pixels = 0;
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
        const plausibleSize = pixels >= 18 && pixels <= 6500;
        const plausibleShape = componentWidth <= platform.r * 0.8 && componentHeight <= platform.r * 0.8;
        if (plausibleSize && plausibleShape && (!bestComponent || pixels > bestComponent.pixels)) {
          bestComponent = { pixels, sumX, sumY, minX, maxX, minY, maxY };
        }
      }
    }

    if (!bestComponent) {
      return {
        status: 'error',
        message: 'No plausible mouse-sized dark component found',
        confidence: 0,
        source: uploadedVideo ? 'video' : 'sample',
        darkPixels,
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
        darkPixels,
        componentPixels: bestComponent.pixels,
      };
    }
    const vectorLength = Math.max(1, Math.hypot(nearestTarget.x - body.x, nearestTarget.y - body.y));
    const nose = {
      x: clamp(body.x + ((nearestTarget.x - body.x) / vectorLength) * 14, 0, width),
      y: clamp(body.y + ((nearestTarget.y - body.y) / vectorLength) * 14, 0, height),
    };
    const occupancy = bestComponent.pixels / Math.max(1, darkPixels);
    const confidence = clamp(occupancy * 1.6, 0.15, 0.86);

    return {
      status: 'ready',
      message: `Detected dark component at ${Math.round(body.x)}, ${Math.round(body.y)}`,
      confidence,
      source: uploadedVideo ? 'video' : 'sample',
      darkPixels,
      componentPixels: bestComponent.pixels,
      body,
      nose,
    };
  }

  function readRenderedFrameAnalysis(source: CanvasImageSource) {
    const canvas = analysisCanvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !context) throw new Error('Frame canvas is not available');

    canvas.width = 640;
    canvas.height = 480;
    context.clearRect(0, 0, 640, 480);
    context.drawImage(source, 0, 0, 640, 480);
    return analyzeImageData(context.getImageData(0, 0, 640, 480));
  }

  function writeAnalysisToCurrentFrame(result: FrameAnalysis) {
    if (result.status !== 'ready' || !result.body || !result.nose) return;
    const nextId = selectedSkeleton?.id ?? 1;
    updateFrameAnnotation((annotation) => {
      const nextSkeleton = {
        id: nextId,
        label: `Mouse ${nextId}`,
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
      };
    });
    setLayers((current) => ({ ...current, skeletons: true }));
    setCorrections((value) => value + 1);
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

  function markCurrentFrameReviewed() {
    if (!currentReviewFlag) return;
    setReviewFlagsByVideo((current) => ({
      ...current,
      [activeVideoKey]: (current[activeVideoKey] ?? []).map((flag) =>
        flag.frame === currentFrame ? { ...flag, reviewed: true } : flag,
      ),
    }));
  }

  function jumpToNextFlaggedFrame() {
    if (!nextOpenReviewFlag) return;
    seekToFrame(nextOpenReviewFlag.frame);
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
      for (let offset = 0; offset < framesToTrack; offset += 1) {
        if (stopTrackingRef.current) break;
        const frame = startFrame + offset;
        const time = frame / fps;
        await waitForVideoSeek(video, time);
        processed = offset + 1;
        const result = readRenderedFrameAnalysis(video);
        if (result.status === 'ready' && result.body && result.nose) {
          const skeletonId = selectedSkeletonId || 1;
          trackedFrames[String(frame)] = {
            skeletons: [
              {
                id: skeletonId,
                label: `Mouse ${skeletonId}`,
                body: result.body,
                nose: result.nose,
              },
            ],
            selectedSkeletonId: skeletonId,
            events: [],
            touched: true,
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
          nextReviewFlags.push({
            frame,
            reason: 'no-detection',
            confidence: 0,
            reviewed: false,
          });
        }
        if (offset % 5 === 0 || offset === framesToTrack - 1) {
          setCurrentTime(time);
          setTrackingRun({
            status: 'running',
            processed,
            total: framesToTrack,
            saved,
            message: `${label}: frame ${frame + 1}`,
          });
        }
      }

      setAnnotationStore((current) => ({
        ...current,
        [activeVideoKey]: {
          ...current[activeVideoKey],
          ...trackedFrames,
        },
      }));
      setReviewFlagsByVideo((current) => ({
        ...current,
        [activeVideoKey]: mergeReviewFlags(current[activeVideoKey] ?? [], nextReviewFlags),
      }));
      setLayers((current) => ({ ...current, skeletons: true }));
      setCorrections((value) => value + saved);
      setTrackingRun({
        status: 'done',
        processed,
        total: framesToTrack,
        saved,
        message: stopTrackingRef.current
          ? `Stopped after saving ${saved} frames`
          : `${label} saved ${saved} draft frame annotations`,
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
    return skeletons.reduce<{ skeleton: Skeleton | null; distance: number }>(
      (nearest, skeleton) => {
        const bodyDistance = Math.hypot(skeleton.body.x - point.x, skeleton.body.y - point.y);
        const noseDistance = Math.hypot(skeleton.nose.x - point.x, skeleton.nose.y - point.y);
        const distanceToSkeleton = Math.min(bodyDistance, noseDistance);
        return distanceToSkeleton < nearest.distance
          ? { skeleton, distance: distanceToSkeleton }
          : nearest;
      },
      { skeleton: null, distance: Infinity },
    );
  }

  function addEvent(type: 'investigation' | 'escape', point: Point) {
    const hole = nearestHole(point);
    if (!hole) return;
    updateFrameAnnotation((annotation) => ({
      ...annotation,
      events: [...annotation.events, { type, frame: currentFrame, hole: hole.id, source: 'manual' }],
    }));
    setCorrections((value) => value + 1);
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const point = stagePoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (toolMode === 'select') {
      if (!layers.skeletons) return;
      const nearest = nearestSkeleton(point);
      if (nearest.skeleton && nearest.distance <= 28) {
        selectSkeleton(nearest.skeleton.id);
        setDragTarget({
          type: 'skeleton',
          skeletonId: nearest.skeleton.id,
          start: point,
          body: nearest.skeleton.body,
          nose: nearest.skeleton.nose,
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
      setToolMode('body');
      return;
    }
    if (toolMode === 'body') {
      if (!selectedSkeleton) return;
      setLayers((current) => ({ ...current, skeletons: true }));
      updateSkeletonNode(selectedSkeleton.id, 'body', point);
      setDragTarget({ type: 'body', skeletonId: selectedSkeleton.id });
      setCorrections((value) => value + 1);
      return;
    }
    if (toolMode === 'nose') {
      if (!selectedSkeleton) return;
      setLayers((current) => ({ ...current, skeletons: true }));
      updateSkeletonNode(selectedSkeleton.id, 'nose', point);
      setDragTarget({ type: 'nose', skeletonId: selectedSkeleton.id });
      setCorrections((value) => value + 1);
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
    if (dragTarget.type === 'skeleton') {
      const dx = point.x - dragTarget.start.x;
      const dy = point.y - dragTarget.start.y;
      updateSkeletonPair(
        dragTarget.skeletonId,
        { x: dragTarget.body.x + dx, y: dragTarget.body.y + dy },
        { x: dragTarget.nose.x + dx, y: dragTarget.nose.y + dy },
      );
      return;
    }
    if (dragTarget.type === 'body') updateSkeletonNode(dragTarget.skeletonId, 'body', point);
    if (dragTarget.type === 'nose') updateSkeletonNode(dragTarget.skeletonId, 'nose', point);
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragTarget(null);
  }

  const projectJson = JSON.stringify(
    {
      video: activeLabel,
      currentTimeSeconds: currentTime,
      currentFrame,
      fps,
      targetHole,
      selectedWellId,
      layers,
      roi: { platform, holes },
      holeTemplate: { scale: holeScale, rotationDegrees },
      correctionLayer: {
        currentFrame: { skeletons, selectedSkeletonId, events, touched: frameAnnotation.touched },
        frameAnnotations: annotationStore[activeVideoKey] ?? {},
        savedFrameCount,
        correctionCount: corrections,
      },
      frameAnalysis,
      trackingRun,
      eventLog,
      derivedMetrics: {
        primaryLatencySeconds: derivedPrimaryLatency,
        totalLatencySeconds: derivedTotalLatency,
        primaryErrors: hasDerivedResults ? primaryErrors : null,
        totalErrors: hasDerivedResults ? adjustedErrors : null,
        pathCm: derivedPathCm,
        speedCmPerSecond: derivedSpeedCms,
        targetQuadrantPercent: derivedTargetQuadrantPct,
        strategy: finalStrategy,
        strategyOverride,
        strategyReason: autoStrategy.reason,
        trackedPercent: resultTrackedPercent,
      },
      reviewQueue: {
        flags: reviewFlags,
        openCount: openReviewFlags.length,
        currentFrameFlag: currentReviewFlag ?? null,
      },
      thresholds: {
        dwellSeconds: dwell,
        noseDistanceCm: distance,
        platformDiameterCm,
        pixelsPerCm,
      },
      source: 'BarnesAI annotation surface state',
    },
    null,
    2,
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Salk AIRC Task 1
            </p>
            <h1 className="text-2xl font-semibold tracking-normal">BarnesAI</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Frame-based Barnes maze review: video underlay, annotation overlay,
              editable well map, mouse correction points, and spreadsheet-ready
              exports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              accept="video/mp4,video/*"
              className="sr-only"
              multiple={false}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) loadVideo(file);
              }}
              ref={fileInputRef}
              type="file"
            />
            <button
              className="tool-button"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <FolderOpen size={16} aria-hidden="true" />
              Load video
            </button>
            <button className="tool-button primary" onClick={togglePlayback} type="button">
              {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[108rem] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_270px]">
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
                  download(projectJson, `${selected.id}-barnesai-project.json`, 'application/json')
                }
                type="button"
              >
                <FileJson size={16} />
              </button>
            </div>
          </div>

          <div className="trial-strip" aria-label="Session videos">
            {uploadedVideo ? (
              <button
                aria-label={`Selected local video ${uploadedVideo.name}`}
                className="trial-card active local"
                type="button"
              >
                <span className="local-video-icon">
                  <Play size={16} aria-hidden="true" />
                </span>
                <span>
                  <strong>{uploadedVideo.name}</strong>
                  <small>
                    local MP4 · {uploadedVideo.durationSeconds > 0
                      ? formatSeconds(uploadedVideo.durationSeconds)
                      : 'metadata pending'}
                  </small>
                </span>
              </button>
            ) : null}
            {!uploadedVideo
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
          </div>

          <div className="frame-status-strip" aria-label="Frame review status">
            <section className="frame-status-card">
              <div className="frame-status-heading">
                <h3>Current frame</h3>
                <span>{frameAnnotation.touched ? 'saved' : 'draft'}</span>
              </div>
              {selectedSkeleton ? (
                <p>
                  {selectedSkeleton.label} · Body {Math.round(selectedSkeleton.body.x)},{' '}
                  {Math.round(selectedSkeleton.body.y)} · Nose {Math.round(selectedSkeleton.nose.x)},{' '}
                  {Math.round(selectedSkeleton.nose.y)}
                </p>
              ) : (
                <p>No skeleton selected</p>
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
                <h3>Review queue</h3>
                <span>
                  {openReviewFlags.length} open / {reviewFlags.length} total
                </span>
              </div>
              <p>
                {currentReviewFlag
                  ? `Current frame: ${currentReviewFlag.reason.replace('-', ' ')}`
                  : nextOpenReviewFlag
                    ? `Next flagged frame: ${nextOpenReviewFlag.frame + 1}`
                    : 'No flagged frames'}
              </p>
              <div className="review-actions">
                <button
                  disabled={openReviewFlags.length === 0}
                  onClick={jumpToNextFlaggedFrame}
                  type="button"
                >
                  Next flagged
                </button>
                <button
                  disabled={!currentReviewFlag}
                  onClick={markCurrentFrameReviewed}
                  type="button"
                >
                  Mark reviewed
                </button>
              </div>
            </section>
          </div>

          <div className="canvas-workspace">
            <aside className="canvas-dock canvas-dock-left" aria-label="Overlay tools and layers">
              <div className="dock-section">
                <h3>Tools</h3>
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
                <h3>Layers</h3>
                <div className="layer-list">
                  {([
                    ['maze', 'Platform'],
                    ['wells', 'Wells'],
                    ['skeletons', 'Mice / Skeleton'],
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
                      setUploadedVideo((current) =>
                        current
                          ? {
                              ...current,
                              durationSeconds: video.duration,
                              width: video.videoWidth || 640,
                              height: video.videoHeight || 480,
                            }
                          : current,
                      );
                    }}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)}
                    onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
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
                  {layers.skeletons
                    ? skeletons.map((skeleton) => (
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
                      ))
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
            </div>

            <aside className="canvas-dock canvas-dock-right" aria-label="Overlay object lists">
              <div className="object-panel">
                <div className="object-tabs" role="tablist" aria-label="Overlay objects">
                  {([
                    ['mice', `Mice ${skeletons.length}`],
                    ['wells', `Wells ${holes.length}`],
                    ['events', `Events ${eventLog.length}`],
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
                      <h3>Mice / Skeleton</h3>
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
                          <strong>{skeleton.label}</strong>
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
                      <h3>Wells</h3>
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
                      <h3>Events</h3>
                      <span>{eventLog.length} detected</span>
                    </div>
                    <div className="object-tree">
                      {eventLog.length > 0 ? (
                        eventLog.slice(0, 16).map((event) => (
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
                              {event.type === 'escape' ? 'Escape' : 'Visit'} · Well {event.hole}
                            </strong>
                            <span>
                              Frame {event.startFrame + 1} · {formatSeconds(event.timeSeconds)}
                            </span>
                            <span>
                              {event.source} · {event.durationSeconds.toFixed(2)} s ·{' '}
                              {Math.round(event.confidence * 100)}%
                            </span>
                          </button>
                        ))
                      ) : (
                        <p>No events yet</p>
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            </aside>
          </div>

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
            <label>
              <span>Jump frame</span>
              <input
                max={totalFrames}
                min="1"
                onChange={(event) => seekToFrame(Number(event.target.value) - 1)}
                type="number"
                value={currentFrame + 1}
              />
            </label>
            <label>
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
              Video time {currentTime.toFixed(2)} s / {activeDuration.toFixed(2)} s
            </span>
            <input
              max={activeDuration || 0}
              min="0"
              onChange={(event) => {
                const time = Number(event.target.value);
                setCurrentTime(time);
                if (videoRef.current) videoRef.current.currentTime = time;
              }}
              step={1 / fps}
              type="range"
              value={Math.min(currentTime, activeDuration || 0)}
            />
          </label>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
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
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
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
          <p className="roi-note">
            <MousePointer2 size={14} aria-hidden="true" />
            Select a tool, then click or drag directly on the overlay. Left/right arrow
            keys step by frame; space toggles playback.
          </p>
          <canvas
            aria-hidden="true"
            className="analysis-canvas"
            height="480"
            ref={analysisCanvasRef}
            width="640"
          />

          <section className="results-section">
            <div className="panel-heading">
              <h2>Results</h2>
              <span>{eventLog.length > 0 ? 'event-derived' : 'pending'}</span>
            </div>

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
                      {resultTrackedPercent !== null
                        ? `${resultTrackedPercent.toFixed(1)}% frames tracked`
                        : 'Tracking not run'}
                    </strong>
                  </div>
                  <p>
                    {hasTrackingSummary
                      ? `${reviewFlags.length} frames are flagged for review.`
                      : 'Run Track full or Next 60 to generate tracking results.'}
                  </p>
                </div>

                {reviewFlags.length > 0 ? (
                  <div className="warning-box">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <p>Review flagged frames before treating exported metrics as final.</p>
                  </div>
                ) : null}

                <div className="result-actions">
                  <button
                    className="wide-action"
                    onClick={() => setCorrections((value) => value + 1)}
                    type="button"
                  >
                    <MousePointer2 size={16} aria-hidden="true" />
                    Mark reviewed correction
                  </button>
                  <button
                    className="wide-action primary"
                    onClick={() => download(csv, 'barnesai-trial-summary.csv', 'text/csv')}
                    type="button"
                  >
                    <Download size={16} aria-hidden="true" />
                    Summary CSV
                  </button>
                  <button
                    className="wide-action"
                    disabled={eventLog.length === 0}
                    onClick={() => download(eventCsv, 'barnesai-event-detail.csv', 'text/csv')}
                    type="button"
                  >
                    <Download size={16} aria-hidden="true" />
                    Event CSV
                  </button>
                </div>
              </div>
            </div>

            <div className="strategy">
              <div className="strategy-heading">
                <strong>Search strategy</strong>
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
              <span>
                {finalStrategy
                  ? `${finalStrategy} · ${autoStrategy.reason}`
                  : autoStrategy.reason}
              </span>
            </div>
          </section>
        </section>

        <aside className="panel order-3 guide-panel">
          <div className="panel-heading">
            <h2>How to use</h2>
            <span>quick workflow</span>
          </div>

          <ol className="guide-steps">
            <li>
              <strong>Load video</strong>
              <span>Use Load video, or choose a sample trial from the video queue.</span>
            </li>
            <li>
              <strong>Align maze</strong>
              <span>Use Maze to move the platform. Use Well to drag individual wells.</span>
            </li>
            <li>
              <strong>Set target</strong>
              <span>Select Target, then click the escape well on the overlay.</span>
            </li>
            <li>
              <strong>Edit mouse</strong>
              <span>Use Body and Nose to correct nodes. Use Add nodes for another mouse.</span>
            </li>
            <li>
              <strong>Track video</strong>
              <span>Run Track full for the whole video, or Next 60 for a short pass.</span>
            </li>
            <li>
              <strong>Review flags</strong>
              <span>Use Next flagged to inspect weak frames, then Mark reviewed.</span>
            </li>
            <li>
              <strong>Check lists</strong>
              <span>Use the right dock tabs: Mice, Wells, and Events.</span>
            </li>
            <li>
              <strong>Export</strong>
              <span>Use Download CSV below the video, or the JSON icon above it.</span>
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
