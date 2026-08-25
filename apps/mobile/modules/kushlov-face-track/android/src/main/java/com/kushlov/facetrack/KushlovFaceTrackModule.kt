package com.kushlov.facetrack

import android.os.Handler
import android.os.Looper
import com.oney.WebRTCModule.videoEffects.ProcessorProvider
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessorFactoryInterface
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KushlovFaceTrackModule : Module() {
  private var registered = false

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
    }

    OnDestroy {
      FaceTrackBridge.emitter = null
    }

    Function("isAvailable") {
      true
    }

    Function("attachProcessor") {
      if (registered) return@Function true
      try {
        ProcessorProvider.addProcessor(
          "kushlovFace",
          object : VideoFrameProcessorFactoryInterface {
            override fun build(): com.oney.WebRTCModule.videoEffects.VideoFrameProcessor {
              return FaceFrameProcessor()
            }
          },
        )
        registered = true
        true
      } catch (_: Throwable) {
        false
      }
    }
  }
}

internal object FaceTrackBridge {
  @Volatile
  var emitter: ((Map<String, Any?>) -> Unit)? = null
}
