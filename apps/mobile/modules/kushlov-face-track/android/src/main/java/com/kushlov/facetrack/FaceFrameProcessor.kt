package com.kushlov.facetrack

import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessor
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoFrame
import java.nio.ByteBuffer
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.hypot

/**
 * Pass-through LiveKit frame processor. Detects a face off-thread and never
 * replaces the frame. Extra retain() offsets a known double-release in
 * react-native-webrtc VideoEffectProcessor when the same instance is returned.
 */
internal class FaceFrameProcessor : VideoFrameProcessor {
  private val executor = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  private var lastEmit = 0L
  private var detector: FaceDetector? = null

  private fun detector(): FaceDetector? {
    val existing = detector
    if (existing != null) return existing
    return try {
      FaceDetection.getClient(
        FaceDetectorOptions.Builder()
          .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
          .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
          .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
          .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
          .setMinFaceSize(0.15f)
          .build(),
      ).also { detector = it }
    } catch (_: Throwable) {
      null
    }
  }

  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    try {
      val now = System.currentTimeMillis()
      if (now - lastEmit >= 160 && busy.compareAndSet(false, true)) {
        lastEmit = now
        // toI420 must run on the SurfaceTextureHelper / capturer thread.
        val i420 = try {
          frame.buffer.toI420()
        } catch (_: Throwable) {
          busy.set(false)
          null
        }
        if (i420 == null) {
          busy.set(false)
        } else {
          val rotation = frame.rotation
          executor.execute {
            try {
              detect(i420, rotation)
            } catch (_: Throwable) {
              emitEmpty()
            } finally {
              try {
                i420.release()
              } catch (_: Throwable) {
                /* already released */
              }
              busy.set(false)
            }
          }
        }
      }
    } catch (_: Throwable) {
      busy.set(false)
    }
    frame.retain()
    return frame
  }

  private fun detect(i420: VideoFrame.I420Buffer, rotation: Int) {
    val client = detector() ?: return
    val srcW = i420.width
    val srcH = i420.height
    if (srcW < 16 || srcH < 16) return emitEmpty()
    val step = if (srcW * srcH > 640 * 480) 2 else 1
    val width = (srcW / step).let { it - it % 2 }.coerceAtLeast(16)
    val height = (srcH / step).let { it - it % 2 }.coerceAtLeast(16)
    val nv21 = i420ToNv21(i420, srcW, srcH, width, height, step)
    val image = InputImage.fromByteArray(
      nv21,
      width,
      height,
      rotation,
      InputImage.IMAGE_FORMAT_NV21,
    )
    val task = client.process(image)
    val faces = try {
      com.google.android.gms.tasks.Tasks.await(task, 220, java.util.concurrent.TimeUnit.MILLISECONDS)
    } catch (_: Throwable) {
      emitEmpty()
      return
    }
    val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
    if (face == null) {
      emitEmpty()
      return
    }
    emitFace(face, width, height, rotation)
  }

  private fun emitFace(face: Face, rawW: Int, rawH: Int, rotation: Int) {
    val uprightW = if (rotation == 90 || rotation == 270) rawH else rawW
    val uprightH = if (rotation == 90 || rotation == 270) rawW else rawH
    if (uprightW <= 0 || uprightH <= 0) return emitEmpty()
    val box = face.boundingBox
    val cx = ((box.left + box.right) * 0.5f) / uprightW
    val cy = ((box.top + box.bottom) * 0.5f) / uprightH
    val width = box.width().toFloat() / uprightW
    val height = box.height().toFloat() / uprightH
    val leftEye = face.getLandmark(FaceLandmark.LEFT_EYE)?.position
    val rightEye = face.getLandmark(FaceLandmark.RIGHT_EYE)?.position
    val nose = face.getLandmark(FaceLandmark.NOSE_BASE)?.position
    val mouth = face.getLandmark(FaceLandmark.MOUTH_BOTTOM)?.position
    val payload = mutableMapOf<String, Any?>(
      "detected" to true,
      "cx" to cx.toDouble().coerceIn(0.05, 0.95),
      "cy" to cy.toDouble().coerceIn(0.05, 0.95),
      "width" to width.toDouble().coerceIn(0.12, 0.95),
      "height" to height.toDouble().coerceIn(0.14, 0.95),
      "rotation" to face.headEulerAngleZ.toDouble(),
    )
    if (leftEye != null && rightEye != null) {
      payload["eyeCx"] = ((leftEye.x + rightEye.x) * 0.5f / uprightW).toDouble()
      payload["eyeCy"] = ((leftEye.y + rightEye.y) * 0.5f / uprightH).toDouble()
      payload["eyeW"] = (
        hypot(
          (leftEye.x - rightEye.x).toDouble(),
          (leftEye.y - rightEye.y).toDouble(),
        ) * 2.6 / uprightW
      )
    }
    mouth?.let {
      payload["mouthCx"] = (it.x / uprightW).toDouble()
      payload["mouthCy"] = (it.y / uprightH).toDouble()
    }
    nose?.let {
      payload["noseCx"] = (it.x / uprightW).toDouble()
      payload["noseCy"] = (it.y / uprightH).toDouble()
    }
    payload["foreheadCx"] = cx.toDouble()
    payload["foreheadCy"] = (cy - height * 0.42).toDouble()
    FaceTrackBridge.emitter?.invoke(payload)
  }

  private fun emitEmpty() {
    FaceTrackBridge.emitter?.invoke(mapOf("detected" to false))
  }

  private fun i420ToNv21(
    i420: VideoFrame.I420Buffer,
    srcW: Int,
    srcH: Int,
    dstW: Int,
    dstH: Int,
    step: Int,
  ): ByteArray {
    val ySize = dstW * dstH
    val nv21 = ByteArray(ySize + ySize / 2)
    val y = i420.dataY
    val yStride = i420.strideY
    var out = 0
    for (row in 0 until dstH) {
      val srcRow = (row * step).coerceAtMost(srcH - 1) * yStride
      for (col in 0 until dstW) {
        nv21[out++] = y.get(srcRow + (col * step).coerceAtMost(srcW - 1))
      }
    }
    val chromaH = dstH / 2
    val chromaW = dstW / 2
    val v = i420.dataV
    val u = i420.dataU
    val vStride = i420.strideV
    val uStride = i420.strideU
    for (row in 0 until chromaH) {
      val srcRow = (row * step).coerceAtMost(srcH / 2 - 1)
      val vRow = srcRow * vStride
      val uRow = srcRow * uStride
      for (col in 0 until chromaW) {
        val srcCol = (col * step).coerceAtMost(srcW / 2 - 1)
        nv21[out++] = v.get(vRow + srcCol)
        nv21[out++] = u.get(uRow + srcCol)
      }
    }
    return nv21
  }
}
