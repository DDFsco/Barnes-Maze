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
  { id: 'move-hole', label: 'Hole' },
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

function formatSeconds(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.round(safeValue % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function buildHolePoints(platform: Platform, scale: number, rotationDegrees = 0) {
  return Array.from({ length: 20 }, (_, index) => {
    const angle =
      -Math.PI / 2 + (rotationDegrees * Math.PI) / 180 + (index / 20) * Math.PI * 2;
    const r = platform.r * scale;
    return {
      id: index + 1,
      x: platform.x + Math.cos(angle) * r,
      y: platform.y + Math.sin(angle) * r,
      radius: 10,
    };
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function makeSkeleton(id: number, body: Point): Skeleton {
  return {
    id,
    label: `Mouse ${id}`,
    body,
    nose: { x: body.x + 18, y: body.y - 14 },
  };
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState(samples[0].id);
  const [targetHole, setTargetHole] = useState(samples[0].targetHole);
  const [dwell, setDwell] = useState(0.5);
  const [distance, setDistance] = useState(1.8);
  const [corrections, setCorrections] = useState(1);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(samples[0].fpsValue);
  const [platform, setPlatform] = useState(samples[0].platform);
  const [holes, setHoles] = useState(() => buildHolePoints(samples[0].platform, 0.92));
  const [holeScale, setHoleScale] = useState(0.92);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [skeletons, setSkeletons] = useState<Skeleton[]>(() => [
    makeSkeleton(1, samples[0].mouse),
  ]);
  const [selectedSkeletonId, setSelectedSkeletonId] = useState(1);
  const [layers, setLayers] = useState<LayerVisibility>({
    maze: true,
    wells: true,
    skeletons: true,
    events: true,
  });
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [events, setEvents] = useState<
    Array<{ type: 'investigation' | 'escape'; frame: number; hole: number; source: 'manual' }>
  >([]);

  const selected = samples.find((sample) => sample.id === selectedId) ?? samples[0];
  const activeDuration = uploadedVideo?.durationSeconds || selected.durationSeconds;
  const activeLabel = uploadedVideo?.name ?? selected.fileName;
  const totalFrames = Math.max(1, Math.round(activeDuration * fps));
  const currentFrame = clamp(Math.round(currentTime * fps), 0, totalFrames - 1);
  const selectedSkeleton =
    skeletons.find((skeleton) => skeleton.id === selectedSkeletonId) ?? skeletons[0];
  const adjustedErrors = Math.max(
    0,
    Math.round(selected.totalErrors + (1.2 - distance) * 2 - dwell),
  );
  const csv = useMemo(() => {
    const rows = [
      [
        'video',
        'duration_seconds',
        'fps',
        'target_hole',
        'primary_latency_seconds',
        'total_latency_seconds',
        'primary_errors',
        'total_errors',
        'path_cm',
        'speed_cm_s',
        'target_quadrant_percent',
        'strategy',
        'tracked_percent',
        'manual_corrections',
      ],
      ...samples.map((sample) => [
        sample.fileName,
        sample.durationSeconds.toFixed(2),
        sample.fpsLabel,
        sample.id === selected.id ? targetHole : sample.targetHole,
        sample.primaryLatency.toFixed(1),
        sample.totalLatency.toFixed(1),
        sample.primaryErrors,
        sample.id === selected.id ? adjustedErrors : sample.totalErrors,
        sample.pathCm.toFixed(1),
        sample.speedCms.toFixed(1),
        sample.targetQuadrantPct.toFixed(1),
        sample.strategy,
        sample.trackedPct.toFixed(1),
        sample.id === selected.id ? corrections : 0,
      ]),
    ];
    return rows.map((row) => row.join(',')).join('\n');
  }, [adjustedErrors, corrections, selected.id, targetHole]);

  useEffect(() => {
    return () => {
      if (uploadedVideo?.url) URL.revokeObjectURL(uploadedVideo.url);
    };
  }, [uploadedVideo?.url]);

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
            'Return the currently selected Barnes maze trial, thresholds, ROI, corrections, and draft metrics.',
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
              thresholds: { dwellSeconds: dwell, noseProxyDistanceCm: distance },
              layers,
              roi: { platform, holes, holeScale, rotationDegrees },
              corrections: { skeletons, selectedSkeletonId, events, count: corrections },
              quality: {
                trackedPercent: selected.trackedPct,
                failedFrames: selected.failureFrames,
              },
              metrics: {
                primaryLatencySeconds: selected.primaryLatency,
                totalLatencySeconds: selected.totalLatency,
                primaryErrors: selected.primaryErrors,
                totalErrors: adjustedErrors,
                pathCm: selected.pathCm,
                speedCmPerSecond: selected.speedCms,
                targetQuadrantPercent: selected.targetQuadrantPct,
                strategy: selected.strategy,
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
    events,
    holes,
    holeScale,
    layers,
    platform,
    rotationDegrees,
    selected,
    selectedSkeletonId,
    skeletons,
    targetHole,
  ]);

  function selectSample(sample: SampleVideo) {
    setSelectedId(sample.id);
    setTargetHole(sample.targetHole);
    setPlatform(sample.platform);
    const nextHoles = buildHolePoints(sample.platform, 0.92, 0);
    setHoles(nextHoles);
    setHoleScale(0.92);
    setRotationDegrees(0);
    setSkeletons([makeSkeleton(1, sample.mouse)]);
    setSelectedSkeletonId(1);
    setFps(sample.fpsValue);
    setCurrentTime(0);
    setEvents([]);
    setToolMode('select');
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
    setEvents([]);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  }

  function seekToFrame(frame: number) {
    const safeFrame = clamp(frame, 0, totalFrames - 1);
    const nextTime = safeFrame / fps;
    setCurrentTime(nextTime);
    if (videoRef.current) videoRef.current.currentTime = nextTime;
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
    if (key === 'r') setHoles(buildHolePoints({ ...platform, r: value }, holeScale, rotationDegrees));
  }

  function updateHoleTemplate(nextScale: number, nextRotation: number) {
    setHoleScale(nextScale);
    setRotationDegrees(nextRotation);
    setHoles(buildHolePoints(platform, nextScale, nextRotation));
  }

  function resetRoi() {
    setPlatform(selected.platform);
    setHoleScale(0.92);
    setRotationDegrees(0);
    setHoles(buildHolePoints(selected.platform, 0.92, 0));
    setTargetHole(selected.targetHole);
    setSkeletons([makeSkeleton(1, selected.mouse)]);
    setSelectedSkeletonId(1);
    setEvents([]);
  }

  function updateSkeletonNode(
    skeletonId: number,
    node: 'body' | 'nose',
    point: Point,
  ) {
    setSkeletons((current) =>
      current.map((skeleton) =>
        skeleton.id === skeletonId ? { ...skeleton, [node]: point } : skeleton,
      ),
    );
  }

  function addSkeleton(point = { x: 320, y: 240 }) {
    const nextId = Math.max(0, ...skeletons.map((skeleton) => skeleton.id)) + 1;
    const nextSkeleton = makeSkeleton(nextId, point);
    setSkeletons((current) => [...current, nextSkeleton]);
    setSelectedSkeletonId(nextId);
    setLayers((current) => ({ ...current, skeletons: true }));
    setCorrections((value) => value + 1);
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
    }, { hole: holes[0], distance: Infinity }).hole;
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
    setEvents((current) => [
      ...current,
      { type, frame: currentFrame, hole: hole.id, source: 'manual' },
    ]);
    setCorrections((value) => value + 1);
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const point = stagePoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (toolMode === 'select') {
      if (!layers.skeletons) return;
      const nearest = nearestSkeleton(point);
      if (nearest.skeleton && nearest.distance <= 28) {
        setSelectedSkeletonId(nearest.skeleton.id);
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
      setSkeletons((current) =>
        current.map((skeleton) =>
          skeleton.id === dragTarget.skeletonId
            ? {
                ...skeleton,
                body: { x: dragTarget.body.x + dx, y: dragTarget.body.y + dy },
                nose: { x: dragTarget.nose.x + dx, y: dragTarget.nose.y + dy },
              }
            : skeleton,
        ),
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
      layers,
      roi: { platform, holes },
      holeTemplate: { scale: holeScale, rotationDegrees },
      correctionLayer: { skeletons, selectedSkeletonId, events, correctionCount: corrections },
      thresholds: { dwellSeconds: dwell, noseDistanceCm: distance },
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
              <button aria-label="Save corrections" type="button">
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
            {samples.map((sample) => (
              <button
                aria-label={`Select ${sample.fileName}`}
                className={`trial-card ${sample.id === selected.id && !uploadedVideo ? 'active' : ''}`}
                key={sample.id}
                onClick={() => {
                  setUploadedVideo(null);
                  selectSample(sample);
                }}
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
            ))}
            <div className="status-strip" aria-label="Workflow status">
              {statuses.map((status) => (
                <span className={status.tone} key={status.name}>
                  {status.name}: {status.value}
                </span>
              ))}
            </div>
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
                    onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                    ref={videoRef}
                    src={uploadedVideo.url}
                  />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={`Representative frame from ${selected.fileName}`} src={selected.frame} />
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
                        <g className="hole-group" key={hole.id}>
                          <circle className="hit-area" cx={hole.x} cy={hole.y} r="14" />
                          <circle
                            className={hole.id === targetHole ? 'target-hole' : 'hole-marker'}
                            cx={hole.x}
                            cy={hole.y}
                            r="7"
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
                    ? events.map((event, index) => {
                        const hole =
                          holes.find((candidate) => candidate.id === event.hole) ?? holes[0];
                        return (
                          <g
                            className={`event-pin ${event.type}`}
                            key={`${event.type}-${event.frame}-${index}`}
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

            <aside className="canvas-dock canvas-dock-right" aria-label="Skeleton layers">
              <div className="annotation-summary compact-summary">
                <h3>Current frame</h3>
                {selectedSkeleton ? (
                  <>
                    <p>Selected: {selectedSkeleton.label}</p>
                    <p>
                      Body: {Math.round(selectedSkeleton.body.x)}, {Math.round(selectedSkeleton.body.y)}
                    </p>
                    <p>
                      Nose: {Math.round(selectedSkeleton.nose.x)}, {Math.round(selectedSkeleton.nose.y)}
                    </p>
                  </>
                ) : (
                  <p>No skeleton selected</p>
                )}
                <p>Events: {events.length}</p>
              </div>

              <div className="skeleton-panel">
                <div className="skeleton-panel-heading">
                  <h3>Mice / Skeleton</h3>
                  <button onClick={() => addSkeleton()} type="button">
                    Add nodes
                  </button>
                </div>
                <div className="skeleton-tree">
                  {skeletons.map((skeleton) => (
                    <button
                      className={skeleton.id === selectedSkeletonId ? 'active' : ''}
                      key={skeleton.id}
                      onClick={() => setSelectedSkeletonId(skeleton.id)}
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

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="control">
              <span>Target hole</span>
              <select value={targetHole} onChange={(event) => setTargetHole(Number(event.target.value))}>
                {Array.from({ length: 20 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Hole {index + 1}
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
        </section>

        <aside className="panel order-3">
          <div className="panel-heading">
            <h2>Results</h2>
            <span>draft metrics</span>
          </div>

          <div className="metric-grid">
            <Metric label="Primary latency" value={`${selected.primaryLatency.toFixed(1)} s`} />
            <Metric label="Total latency" value={`${selected.totalLatency.toFixed(1)} s`} />
            <Metric label="Primary errors" value={String(selected.primaryErrors)} />
            <Metric label="Total errors" value={String(adjustedErrors)} />
            <Metric label="Path length" value={`${selected.pathCm.toFixed(1)} cm`} />
            <Metric label="Speed" value={`${selected.speedCms.toFixed(1)} cm/s`} />
          </div>

          <div className="quality-box">
            <div>
              <CircleDot size={18} aria-hidden="true" />
              <strong>{selected.trackedPct.toFixed(1)}% frames tracked</strong>
            </div>
            <p>
              {selected.failureFrames} frames require review. Manual correction
              records are stored separately from automatic draft values.
            </p>
          </div>

          <div className="warning-box">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>{selected.caveat}</p>
          </div>

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
            Download CSV
          </button>

          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold">Search strategy</h3>
            <div className="strategy">
              <strong>{selected.strategy}</strong>
              <span>
                Classified from target path directness, ring-following order,
                and center crossings. User can override before export.
              </span>
            </div>
          </div>
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
