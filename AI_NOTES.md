# AI Notes

Tools used:

- Codex GPT-5 as the planning and implementation agent.
- Salk assignment repository as the authoritative product brief.
- Local shell, Node, and browser-oriented Sites scaffold.

Agent judgment moments:

- The initial BarnesAI master specification was intentionally reduced. The original Salk Task 1 makes manual correction, visible definitions, and end-to-end sample-video analysis more important than a large backend or ML platform.
- The first implementation path was kept as classical browser-side CV plus review, because the sample frames show a high-contrast dark animal on a pale platform. Nose tracking is not represented as ground truth; it is explicitly labeled as a proxy.
- The first attempt to run the app exposed a Node/version/native dependency problem. Reinstalling with the bundled Node 24 fixed the missing native binding.

Checks performed:

- Read the Salk task README, Task 1 brief, and sample-data README.
- Inspected all three representative sample frames.
- Built a first runnable workbench with sample trial switching, threshold changes, correction tracking, and CSV/JSON export.
- Added unit tests for frame-time conversion, path length, target visit, escape latency, and primary/total error counting.

