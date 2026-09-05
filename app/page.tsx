'use client';

import {
  AlertTriangle,
  CircleDot,
  Download,
  FileJson,
  FolderOpen,
  Move,
  MousePointer2,
  Play,
  RotateCcw,
  Save,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type SampleVideo = {
  id: string;
  label: string;
  fileName: string;
  frame: string;
  frames: number;
  fps: string;
  durationSeconds: number;
  platform: { x: number; y: number; r: number };
  mouse: { x: number; y: number };
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
    fps: '30 fps',
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
    fps: '15000/1001 fps',
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
    fps: '30 fps',
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

const statuses = [
  { name: 'Video', value: 'loaded', tone: 'good' },
  { name: 'Maze', value: 'auto-fit', tone: 'good' },
  { name: 'Tracking', value: 'review', tone: 'warn' },
  { name: 'Events', value: 'draft', tone: 'warn' },
  { name: 'Export', value: 'ready', tone: 'good' },
];

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function buildHolePoints(platform: SampleVideo['platform'], scale: number) {
  return Array.from({ length: 20 }, (_, index) => {
    const angle = -Math.PI / 2 + (index / 20) * Math.PI * 2;
    const r = platform.r * scale;
    return {
      id: index + 1,
      x: platform.x + Math.cos(angle) * r,
      y: platform.y + Math.sin(angle) * r,
    };
  });
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [selectedId, setSelectedId] = useState(samples[0].id);
  const [targetHole, setTargetHole] = useState(samples[0].targetHole);
  const [dwell, setDwell] = useState(0.5);
  const [distance, setDistance] = useState(1.8);
  const [corrections, setCorrections] = useState(1);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [platform, setPlatform] = useState(samples[0].platform);
  const [holeScale, setHoleScale] = useState(0.92);

  const selected = samples.find((sample) => sample.id === selectedId) ?? samples[0];
  const holes = useMemo(() => buildHolePoints(platform, holeScale), [holeScale, platform]);
  const activeDuration = uploadedVideo?.durationSeconds ?? selected.durationSeconds;
  const activeLabel = uploadedVideo?.name ?? selected.fileName;
  const activeFrame = uploadedVideo ? null : selected.frame;
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
        sample.fps,
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
            'Return the currently selected Barnes maze trial, thresholds, quality summary, and draft metrics.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            return {
              video: activeLabel,
              targetHole,
              thresholds: { dwellSeconds: dwell, noseProxyDistanceCm: distance },
              roi: { platform, holeRingScale: holeScale },
              quality: {
                trackedPercent: selected.trackedPct,
                failedFrames: selected.failureFrames,
                manualCorrections: corrections,
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

    void Promise.resolve(
      modelContext.registerTool(
        {
          name: 'stage_detection_thresholds',
          title: 'Stage detection thresholds',
          description:
            'Update the visible dwell-time and nose-proxy distance thresholds used for Barnes maze event detection.',
          inputSchema: {
            type: 'object',
            properties: {
              dwellSeconds: { type: 'number', minimum: 0.1, maximum: 2 },
              noseProxyDistanceCm: { type: 'number', minimum: 0.5, maximum: 4 },
            },
            required: ['dwellSeconds', 'noseProxyDistanceCm'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const value = input as {
              dwellSeconds?: unknown;
              noseProxyDistanceCm?: unknown;
            };
            if (
              typeof value.dwellSeconds !== 'number' ||
              typeof value.noseProxyDistanceCm !== 'number' ||
              value.dwellSeconds < 0.1 ||
              value.dwellSeconds > 2 ||
              value.noseProxyDistanceCm < 0.5 ||
              value.noseProxyDistanceCm > 4
            ) {
              throw new Error('Thresholds are outside the allowed range.');
            }
            setDwell(value.dwellSeconds);
            setDistance(value.noseProxyDistanceCm);
            return {
              status: 'updated',
              thresholds: {
                dwellSeconds: value.dwellSeconds,
                noseProxyDistanceCm: value.noseProxyDistanceCm,
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
    distance,
    dwell,
    holeScale,
    platform,
    selected,
    targetHole,
  ]);

  function selectSample(sample: SampleVideo) {
    setSelectedId(sample.id);
    setTargetHole(sample.targetHole);
    setPlatform(sample.platform);
    setHoleScale(0.92);
    setCurrentTime(0);
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
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  }

  function updatePlatform(key: keyof SampleVideo['platform'], value: number) {
    setPlatform((current) => ({ ...current, [key]: value }));
  }

  function resetRoi() {
    setPlatform(selected.platform);
    setHoleScale(0.92);
    setTargetHole(selected.targetHole);
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
              Browser-first Barnes maze analysis: local videos, editable ROIs,
              transparent tracking quality, manual correction, and paper-ready
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
              Load videos
            </button>
            <button className="tool-button primary" type="button">
              <Play size={16} aria-hidden="true" />
              Analyze demo set
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="panel order-2 xl:order-1">
          <div className="panel-heading">
            <h2>Session</h2>
            <span>{uploadedVideo ? 'local video loaded' : '3 demo videos'}</span>
          </div>
          {uploadedVideo ? (
            <button
              aria-label={`Selected local video ${uploadedVideo.name}`}
              className="video-row active"
              type="button"
            >
              <span className="local-video-icon">
                <Play size={18} aria-hidden="true" />
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
          <div className="space-y-2">
            {samples.map((sample) => (
              <button
                aria-label={`Select ${sample.fileName}`}
                className={`video-row ${sample.id === selected.id ? 'active' : ''}`}
                key={sample.id}
                onClick={() => {
                  selectSample(sample);
                }}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  src={sample.frame}
                />
                <span>
                  <strong>{sample.fileName}</strong>
                  <small>
                    {sample.frames.toLocaleString()} frames · {formatSeconds(sample.durationSeconds)}
                  </small>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {statuses.map((status) => (
              <div className="status-row" key={status.name}>
                <span>{status.name}</span>
                <strong className={status.tone}>{status.value}</strong>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel order-1 overflow-hidden xl:order-2">
          <div className="panel-heading">
            <div>
              <h2>{selected.label}</h2>
              <span>
                {activeLabel} · {uploadedVideo ? `${uploadedVideo.width}x${uploadedVideo.height}` : selected.fps} · {formatSeconds(activeDuration)}
              </span>
            </div>
            <div className="icon-strip" aria-label="Video tools">
              <button aria-label="Reset ROI" onClick={resetRoi} type="button">
                <RotateCcw size={16} />
              </button>
              <button aria-label="Save corrections" type="button">
                <Save size={16} />
              </button>
              <button
                aria-label="Export project JSON"
                onClick={() =>
                  download(
                    JSON.stringify(
                      {
                        video: selected.fileName,
                        targetHole,
                        roi: { platform, holeRingScale: holeScale },
                        currentTimeSeconds: currentTime,
                        thresholds: { dwellSeconds: dwell, noseDistanceCm: distance },
                        corrections,
                        source: 'BarnesAI demo project state',
                      },
                      null,
                      2,
                    ),
                    `${selected.id}-barnesai-project.json`,
                    'application/json',
                  )
                }
                type="button"
              >
                <FileJson size={16} />
              </button>
            </div>
          </div>

          <div className="video-stage">
            {uploadedVideo ? (
              <video
                aria-label={`Loaded video ${uploadedVideo.name}`}
                controls
                muted
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
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                ref={videoRef}
                src={uploadedVideo.url}
              />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`Representative frame from ${selected.fileName}`}
                  src={activeFrame ?? selected.frame}
                />
              </>
            )}
            <svg aria-hidden="true" viewBox="0 0 640 480">
              <circle
                className="platform-ring"
                cx={platform.x}
                cy={platform.y}
                r={platform.r}
              />
              {holes.map((hole) => (
                <g key={hole.id}>
                  <circle
                    className={hole.id === targetHole ? 'target-hole' : 'hole-marker'}
                    cx={hole.x}
                    cy={hole.y}
                    r="10"
                  />
                  <text x={hole.x + 12} y={hole.y + 4}>
                    {hole.id}
                  </text>
                </g>
              ))}
              <path
                className="trajectory"
                d={`M ${platform.x} ${platform.y} C ${platform.x - 80} ${platform.y + 40}, ${selected.mouse.x - 60} ${selected.mouse.y - 20}, ${selected.mouse.x} ${selected.mouse.y}`}
              />
              <circle className="body-point" cx={selected.mouse.x} cy={selected.mouse.y} r="9" />
              <line
                className="nose-vector"
                x1={selected.mouse.x}
                y1={selected.mouse.y}
                x2={selected.mouse.x + 18}
                y2={selected.mouse.y - 14}
              />
            </svg>
          </div>

          <div className="timeline" aria-label="Tracking timeline">
            <span style={{ width: `${selected.trackedPct}%` }} />
            <i style={{ left: '34%' }} />
            <i style={{ left: '63%' }} />
            <i style={{ left: '82%' }} />
          </div>
          {uploadedVideo ? (
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
                step="0.01"
                type="range"
                value={Math.min(currentTime, activeDuration || 0)}
              />
            </label>
          ) : null}

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
          <div className="mt-3 grid gap-3 md:grid-cols-4">
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
                max="1"
                min="0.75"
                onChange={(event) => setHoleScale(Number(event.target.value))}
                step="0.01"
                type="range"
                value={holeScale}
              />
            </label>
          </div>
          <p className="roi-note">
            <Move size={14} aria-hidden="true" />
            ROI editing is now live: adjust the platform center, radius, and hole ring
            before running tracking.
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
              {selected.failureFrames} frames require review. Automatic output
              and manual correction are kept separate.
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
