# Face filters (web)

## Pipeline

Camera → MediaPipe Face Landmarker → canvas render (privacy FX / stickers / beauty) → `canvas.captureStream()` → LiveKit `LocalVideoTrack` publish.

When filter is `none`, the processed publisher stops and the normal camera track is restored.

## Add a new filter

1. Add an id to `FaceFilterId` in `types.ts`.
2. Add a `FaceFilterDef` entry in `catalog.ts` (`emoji`, `scale`, `yOffset`, optional `privacy` / `beauty`).
3. Optionally extend `renderFaceFilterFrame.ts` for custom drawing.

## Favorites / last filter

Persisted in `localStorage` key `kushlov.faceFilter.settings`.
