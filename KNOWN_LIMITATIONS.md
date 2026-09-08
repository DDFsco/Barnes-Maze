# Known Limitations

- Tracking is browser-side classical computer vision, not a trained pose model. It is intended to create reviewable drafts, not ground-truth coordinates.
- The displayed nose is a `nose_proxy` inferred from the detected body component. It should not be interpreted as a validated head-pose estimate.
- The animal can disappear into a hole or be occluded at the rim. BarnesTrack groups missing and low-confidence frames into review ranges, but a human must decide whether a missing run is an escape or a tracking failure.
- Full-video tracking seeks through the local video sequentially. Long recordings can take time and should remain open until the pass completes.
- Manual annotations, presets, and review ranges persist in browser local storage. They can be restored with the exported project JSON after reconnecting the same source videos, but they are not synchronized across devices or browsers.
- The maze overlay can be calibrated and saved as a preset, but automatic cross-video maze registration is not implemented.
- Path length, speed, target-quadrant occupancy, and search strategy are derived from draft trajectories and require review before use in a scientific figure or manuscript.
- WebMCP tools are registered only when the host exposes `document.modelContext`; the main application does not depend on them.
