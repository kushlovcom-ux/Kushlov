# Face filters (mobile)

## Pipeline

1. `FilterSelector` bottom sheet → Zustand + AsyncStorage settings.
2. `FaceFilterPublisher` → `startProcessedVideoTrack(room)`.
3. If EAS native bridge `global.__KushlovFaceFilterCapture` exists → replace LiveKit camera with processed `MediaStreamTrack` (bitstream).
4. Else → sync `kushlovFaceFilter` LiveKit attribute; remotes render `FaceFilterOverlay`.

## Tracking

`FaceTrackingEngine` is swappable:

```ts
import { setFaceTrackingEngineFactory, MediaPipeFaceTrackingEngine } from './tracking/FaceTrackingEngine';

setFaceTrackingEngineFactory(() => new MediaPipeFaceTrackingEngine());
```

Default is `HeuristicFaceTrackingEngine` (Expo Go safe).

## Add a filter

1. Add id to `FaceFilterId` in `types.ts`.
2. Add catalog entry in `catalog.ts`.
3. Overlay / native renderer pick it up automatically for emoji + privacy modes.

## Battery

When `disableOnLowBattery` is on and `expo-battery` reports low power / &lt;15% charge, filters force to `none`.
