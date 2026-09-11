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

    Function("attachProcessor") { () -> Bool in
      KushlovFaceTrackBridge.registerProcessor()
      true
    }

    // Beauty and background are applied to the published frames, so this is
    // what remote participants see. Called with zeroed values on clear.
    Function("setEffectConfig") { (config: [String: Any]) -> Bool in
      KushlovFaceTrackBridge.setEffectConfig(config)
      return true
    }
  }
}
