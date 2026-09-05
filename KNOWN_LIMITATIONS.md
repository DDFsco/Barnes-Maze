# Known Limitations

- This slice can load and play local MP4 files, but it does not yet extract frames into canvas for computer vision.
- The overlay can be aligned over a local video, but automatic tracking still uses demo values.
- Metrics are demo outputs based on inspected sample metadata and plausible trial summaries, not validated ground truth.
- Nose position is shown as a `nose_proxy`; it is not a trained pose-estimation result.
- Manual correction currently records correction count only. Frame-level point/event editing is not implemented yet.
- CSV export works; XLSX export is still pending.
- Browser persistence through IndexedDB is pending.
- The app has not yet been tested on a real 2019-era laptop or at 200% zoom.
- WebMCP tools are registered opportunistically when the browser provides `document.modelContext`; no supported validation context was available during this local pass.
