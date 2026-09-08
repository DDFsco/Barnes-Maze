# BarnesTrack

BarnesTrack is a browser-first workbench for reviewing Barnes maze videos, creating transparent tracking drafts, correcting uncertain frames, and exporting trial-level data. It is designed for students and core-facility staff who should not need a terminal, Python environment, account, or GPU to review a cohort.

Live URL: [barnes-track.vercel.app](https://barnes-track.vercel.app/)

Demo video: [BarnesTrack workflow recording](demo/barnestrack-demo.mp4)

## What It Does

- Loads multiple local videos by drop, file selection, or folder selection. Video data stays in the browser.
- Places and edits the platform, wells, target well, and individual well radii on a frame-accurate video overlay.
- Generates browser-side classical-CV body and nose-proxy drafts with `Track full` or `Next 60` and a visible progress indicator.
- Groups low-confidence and missing detections into review ranges instead of silently filling them.
- Lets the reviewer scrub, correct body or nose nodes, mark visit/escape events, and preserve manual corrections separately from drafts.
- Computes latency, errors, path length, speed, target-quadrant occupancy, and a reviewable spatial/serial/random strategy label.
- Shows a trajectory overlay, tracking-quality timeline, and occupancy map.
- Exports trial and cohort CSV/XLSX reports, event CSV, and a reloadable project JSON file.

The bundled sample state uses still frames from the three Salk clips. The original videos are intentionally not committed; download them from the [Salk AIRC take-home repository](https://github.com/salk-airc/rse-takehome-2026/tree/main/data/barnes-maze).

## Run Locally

Requires Node.js 22.13 or newer.

```bash
git clone <your-fork-url>
cd barnestrack
npm ci
npm run dev
```

Open `http://localhost:5173`.

Run the checks used before release:

```bash
npm run lint
npm test
npm run build
```

## Review Workflow

1. Drop one or more local videos into the header import area, or choose **Add folder**.
2. Choose a session video from the queue, then load a saved preset or calibrate the maze with **Maze** and **Well**.
3. Select **Target** and click the escape well. Use **Nose / Body** to correct either point on the current frame.
4. Run **Next 60** to validate a short range, then use **Track full** for the trial.
5. Open **Flags** to review grouped low-confidence or missing-detection ranges. Correct the overlay and choose **Unflag & next** only after visual review.
6. Use **Visit** or **Escape** only to add a manually verified event. Automated escape candidates are labeled as possible events until reviewed.
7. Inspect the result metrics, quality timeline, occupancy plot, and behavior strategy rationale. Override strategy only after reviewing the recording.
8. Export a trial Summary CSV/XLSX and Event CSV. After several trials complete, export the cohort CSV/XLSX. Save the project JSON to restore local annotations after reconnecting the same videos.

## Scientific Scope

BarnesTrack deliberately favors honest, inspectable drafts over false precision. The tracker uses local classical computer vision and labels the head estimate as a `nose_proxy`, not a trained pose result. Missing detections are exposed as review ranges; they are never silently interpolated into a trajectory.

Investigation is defined by the visible nose-proxy distance and dwell-time controls. Escape is distinct from investigation and should be confirmed visually when the animal disappears at a target well. Metrics and strategy labels update from the current draft and corrections, but require reviewer judgment before use as validated scientific results.

## Privacy And Cost

Selected videos, extracted frames, tracking calculations, local annotations, and downloads remain in the user's browser. The app has no API key, account, database, or per-run cost.

## Submission Evidence

The [demo recording](demo/barnestrack-demo.mp4) shows the end-to-end browser workflow. It covers loading the three supplied clips (`test50`, `test51`, and `test53`), defining or reusing ROIs, tracking, reviewing a correction, detecting events, and downloading results.

Validated browser-generated outputs are committed in [demo-outputs](demo-outputs): each trial has a tidy summary CSV, event-detail CSV, and trial-report XLSX; the folder root contains cohort CSV/XLSX summaries. The source sample videos are intentionally not committed; the assignment data repository is linked above.

## Validation

- Verified the deployed app on a 2019-era laptop without a GPU.
- Verified the interface at 200% browser zoom.
- Ran the complete workflow against all three provided clips and checked the committed CSV/XLSX exports.
- Ran `npm run lint`, `npm test`, and `npm run build` before release.

The product remains deliberately review-first: automated annotations are drafts, failed or uncertain ranges remain visible, and manual corrections update downstream results.

## Limitations

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for tracking, persistence, performance, and validation constraints.

## AI Notes

See [AI_NOTES.md](AI_NOTES.md) for the implementation approach, judgment calls, and validation steps.
