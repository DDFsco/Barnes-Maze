# Known Limitations

- This slice can load and play local MP4 files, extract frames into canvas, and run a full-video browser-side draft tracking pass.
- Full-video tracking is sequential browser seeking, so long videos may take time and should remain reviewable rather than treated as final ground truth.
- Review queue flags low-confidence and no-detection frames, but it does not yet compute event-level validation or automatically classify investigation/escape events from the tracked path.
- The current-frame detector uses classical dark-component analysis inside the aligned platform ROI; it is a review aid, not a trained pose-estimation model.
- The overlay can be aligned over a local video, rotated, scaled, adjusted per well, and used for layer-based body/nose/event annotations.
- Metrics are draft placeholder outputs based on inspected sample metadata and plausible trial summaries, not validated ground truth.
- Nose position is shown as a `nose_proxy`; it is not a trained pose-estimation result.
- Manual skeleton/event annotations are stored per frame in local browser storage and included in JSON export, but they are not yet persisted through IndexedDB or synced across browsers.
- CSV export works; XLSX export is still pending.
- Larger browser persistence through IndexedDB is pending.
- The app has not yet been tested on a real 2019-era laptop or at 200% zoom.
- WebMCP tools are registered opportunistically when the browser provides `document.modelContext`; no supported validation context was available during this local pass.
