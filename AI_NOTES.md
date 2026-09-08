# AI Notes

Tools used:

- Codex GPT-5 as the planning and implementation agent.
- Salk assignment repository as the authoritative product brief.
- Local shell, Node, and browser-oriented Sites scaffold.

Agent judgment moments:

- The initial BarnesTrack master specification was intentionally reduced. The original Salk Task 1 makes manual correction, visible definitions, and end-to-end sample-video analysis more important than a large backend or ML platform.
- The first implementation path was kept as classical browser-side CV plus review, because the sample frames show a high-contrast dark animal on a pale platform. Nose tracking is not represented as ground truth; it is explicitly labeled as a proxy.
- The first attempt to run the app exposed a Node/version/native dependency problem. The project now pins Node 22.13+ and is validated with the matching runtime.
- The next product increment prioritized real user input over deeper mock metrics: local MP4 loading, playback, timestamp scrubbing, and editable ROI controls were built before making CV tracking claims.
- The annotation model now treats the video window as a shared underlay/overlay surface. Wells are fixed trial ROIs that can be translated, scaled, rotated, and moved individually, while body/nose points and event pins are frame-linked correction records.
- The overlay interaction was reshaped toward drawing-software conventions: tools and layer visibility live beside the video, skeletons are listed as editable body/nose node groups, and the draft path preview was removed to avoid implying validated tracking.

Checks performed:

- Read the Salk task README, Task 1 brief, and sample-data README.
- Inspected all three representative sample frames.
- Built a first runnable workbench with sample trial switching, threshold changes, correction tracking, and CSV/JSON export.
- Added unit tests for frame-time conversion, path length, target visit, escape latency, and primary/total error counting.
