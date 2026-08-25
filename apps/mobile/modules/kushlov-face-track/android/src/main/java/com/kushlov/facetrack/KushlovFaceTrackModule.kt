package com.kushlov.facetrack

import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KushlovFaceTrackModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KushlovFaceTrack")
    Events("onFace")

    OnCreate {
      FaceTrackBridge.emitter = { payload ->
        Handler(Looper.getMainLooper()).post {
          try {
            sendEvent("onFace", payload)
          } catch (_: Throwable) {
            /* JS not ready */
          }
        }
      }
      // Do not register a VideoFrameProcessor here. Attaching one to the
      // LiveKit capturer was crashing host live / video call on camera start.
    }

    OnDestroy {
      FaceTrackBridge.emitter = null
    }

    Function("isAvailable") {
      true
    }
  }
}

internal object FaceTrackBridge {
  @Volatile
  var emitter: ((Map<String, Any?>) -> Unit)? = null
}
