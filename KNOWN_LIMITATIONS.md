# Known Limitations

- This slice can load and play local MP4 files, extract frames into canvas, and run a full-video browser-side draft tracking pass.
- Full-video tracking is sequential browser seeking, so long videos may take time and should remain reviewable rather than treated as final ground truth.
- Review queue flags low-confidence and no-detection frames; event detection now drafts investigation/escape events from nose-to-well dwell time, but it is still a review aid rather than validated ground truth.
- The current-frame detector uses classical dark-component analysis inside the aligned platform ROI; it is a review aid, not a trained pose-estimation model.
- The overlay can be aligned over a local video, rotated, scaled, adjusted per well, and used for layer-based body/nose/event annotations.
- Metrics are generated only from current annotations/events/tracking output. Missing results are shown as not generated rather than falling back to sample summaries.
- Path length, speed, target-quadrant occupancy, and search strategy are now computed from draft body trajectories and event order, but they still require human review before being treated as validated ground truth.
- Nose position is shown as a `nose_proxy`; it is not a trained pose-estimation result.
- Manual skeleton/event annotations are stored per frame in local browser storage and included in JSON export, but they are not yet persisted through IndexedDB or synced across browsers.
- Trial-summary, event-detail, and cohort-summary exports are available as CSV; trial and cohort reports are also available as XLSX.
- Larger browser persistence through IndexedDB is pending.
- The app has not yet been tested on a real 2019-era laptop or at 200% zoom.
- WebMCP tools are registered opportunistically when the browser provides `document.modelContext`; no supported validation context was available during this local pass.
