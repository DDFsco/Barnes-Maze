# BarnesAI

BarnesAI is a browser-first Barnes maze analysis workbench for the Salk AIRC RSE take-home Task 1. It is designed for students and facility staff who need to turn behavior videos into reviewable metrics and spreadsheet exports without touching a terminal in day-to-day use.

Live URL: https://barnesai.ddfsco.chatgpt.site

Demo video: pending recording.

## Current Scope

This is the first runnable P0 slice. It includes:

- A static web app shell for Barnes maze analysis.
- The three Salk sample trials represented with committed still frames.
- Local MP4 loading through the browser file picker.
- Video underlay with an interactive SVG annotation overlay.
- Frame controls for previous frame, next frame, play/pause, jump-to-frame, FPS, and timestamp scrubbing.
- Editable target-hole and detection-threshold controls.
- Live ROI controls for platform center/radius, well-ring scale, well-map rotation, draggable individual wells, target selection, and mouse body/nose proxy corrections.
- Draft per-trial metrics and tracking-quality indicators.
- Manual correction count tracking.
- CSV and JSON downloads from the browser.
- A small WebMCP-compatible agent surface for reading the selected trial and staging event thresholds.
- Unit tests for core Barnes maze metric calculations.

Raw sample videos are not committed here. They remain in the original Salk repository.

## Run Locally

Use Node 22.13 or newer. On this machine, the Codex bundled Node works:

```bash
cd /Users/ddfsco/Documents/ChatGPT/Ray/barnesai
PATH=/Users/ddfsco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm install
PATH=/Users/ddfsco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run dev
```

Then open:

```text
http://localhost:3000/
```

If you use your own Node 22+ install, normal commands are enough:

```bash
npm install
npm run dev
```

## How to Operate

1. Open the app.
2. To use the built-in sample state, choose `test50.mp4`, `test51.mp4`, or `test53.mp4` from the left session list.
3. To load a real local video, click `Load video` and select one of the Salk sample MP4 files from `/Users/ddfsco/Documents/ChatGPT/Ray/salk-rse-takehome-2026/data/barnes-maze/`.
4. Review the platform boundary, hole markers, target hole, and the preset body/nose skeleton over the frame/video.
5. Use `Prev`, `Next`, jump-to-frame, or the `Video time` scrubber to move through the trial. Left/right arrow keys step by frame, and space toggles playback.
6. Use the left-side tool and layer panels like a drawing app:
   - Layer checkboxes show or hide Platform boundary, Wells, Mice / Skeleton, and Events.
   - `Add nodes`: click the video overlay to create another mouse skeleton with body and nose nodes.
   - `Select`: click near an existing skeleton to select and drag that body/nose pair together.
   - `Maze`: drag the full platform and well map together.
   - `Hole`: drag the nearest well marker to the true hole center.
   - `Target`: click a well to mark it as the target.
   - `Body`: click or drag the selected skeleton's body point for the current frame.
   - `Nose`: click or drag the selected skeleton's nose-proxy point for the current frame.
   - `Visit`: click near a well to add a manual investigation event.
   - `Escape`: click near a well to add a manual escape event.
7. Use the right-side `Mice / Skeleton` panel to select each mouse and inspect its body/nose coordinates.
8. Adjust dwell-time and nose-proxy distance thresholds. The draft total-error count updates immediately.
9. Use platform X/Y, radius, hole-ring scale, and rotation controls for precise numeric ROI adjustment.
10. Click `Download CSV` for the trial summary.
11. Use the JSON icon above the video panel to export a reloadable project-state sketch with ROI, layer state, skeletons, and correction records.

## Design Details

The product is intentionally a working surface, not a landing page. The first viewport exposes the actual workflow: session selection, video review, layer-based ROI/skeleton overlays, thresholds, quality status, metrics, correction, and export.

The scientific stance is conservative:

- Body tracking and event detection must flag uncertainty.
- Nose/head is represented as a `nose_proxy`, not true pose tracking.
- Manual corrections are tracked separately from automatic output.
- Metrics live in an independent module rather than inside UI code.
- The app assumes local browser processing; no research data leaves the user's machine in this slice.

## What Leaves the User's Machine

In this current implementation, nothing is uploaded. The app runs in the browser, uses committed sample still frames, and creates downloadable CSV/JSON files locally. A future version that processes user-selected videos should keep frame extraction and classical CV in the browser by default.

## Keys and Cost

No API key is required. There are no per-run costs in the current design. If a future optional ML-backed tracker is added, it must have a local/sample fallback and a documented cost estimate.

## Development Checks

```bash
npm test
npm run build
```

## Known Submission Gaps

This is not yet a complete take-home submission. The next implementation steps are canvas frame extraction, automatic platform/hole registration, browser CV tracking, persistent frame-level correction records, event review, XLSX export, committed generated outputs for all three sample videos, accessibility pass, deployment, and walkthrough video.
