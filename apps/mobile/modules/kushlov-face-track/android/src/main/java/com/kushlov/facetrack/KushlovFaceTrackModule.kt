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

    /**
     * Effect parameters for the frame processor. Beauty and background are
     * applied to the published track, so this is what remotes see. Called with
     * zeroed values when the user clears the filter.
     */
    Function("setEffectConfig") { config: Map<String, Any?> ->
      fun number(key: String, fallback: Double) =
        (config[key] as? Number)?.toDouble() ?: fallback
      FaceEffectConfig.update(
        beauty = number("beauty", 0.0).toFloat(),
        brightness = number("brightness", 0.0).toFloat(),
        background = (config["background"] as? String) ?: "none",
        topColor = number("topColor", 0x101018.toDouble()).toInt(),
        bottomColor = number("bottomColor", 0x05050C.toDouble()).toInt(),
        backgroundStrength = number("backgroundStrength", 0.85).toFloat(),
      )
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
