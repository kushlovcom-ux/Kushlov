import ExpoModulesCore

public class KushlovFaceTrackModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KushlovFaceTrack")
    Events("onFace")

    OnCreate {
      let module = self
      KushlovFaceTrackBridge.setEmitter { payload in
        let dict = payload as? [String: Any] ?? [:]
        DispatchQueue.main.async {
          module.sendEvent("onFace", dict)
        }
      }
      // Do not register a VideoFrameProcessor on the LiveKit capturer —
      // that path was crashing the host app when the camera started.
    }

    Function("isAvailable") { () -> Bool in
      true
    }
  }
}
