package com.kushlov.facetrack

import android.os.Handler
import android.os.Looper
import com.oney.WebRTCModule.videoEffects.ProcessorProvider
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessorFactoryInterface
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KushlovFaceTrackModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KushlovFaceTrack")
    Events("onFace")

    OnCreate {
      FaceTrackBridge.emitter = { payload ->
        Handler(Looper.getMainLooper()).post {
          sendEvent("onFace", payload)
        }
      }
      try {
        ProcessorProvider.addProcessor(
          "kushlovFace",
          object : VideoFrameProcessorFactoryInterface {
            override fun build(): com.oney.WebRTCModule.videoEffects.VideoFrameProcessor {
              return FaceFrameProcessor()
            }
          },
        )
      } catch (_: Throwable) {
        /* LiveKit WebRTC not linked in this binary */
      }
    }

    OnDestroy {
      FaceTrackBridge.emitter = null
      try {
        ProcessorProvider.removeProcessor("kushlovFace")
      } catch (_: Throwable) {
        /* ignore */
      }
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
