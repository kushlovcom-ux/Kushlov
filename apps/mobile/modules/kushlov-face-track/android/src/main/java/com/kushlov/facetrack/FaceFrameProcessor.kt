package com.kushlov.facetrack

import com.google.android.gms.tasks.Tasks
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
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.hypot

internal class FaceFrameProcessor : VideoFrameProcessor {
  private val detector: FaceDetector = FaceDetection.getClient(
    FaceDetectorOptions.Builder()
      .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
      .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
      .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
      .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
      .setMinFaceSize(0.12f)
      .build(),
  )
  private val executor = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  private var lastEmit = 0L

  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    val now = System.currentTimeMillis()
    if (now - lastEmit < 80) return frame
    if (!busy.compareAndSet(false, true)) return frame
    lastEmit = now

    // Copy off the GPU texture *now*. Texture buffers are invalid after we return.
    val i420 = try {
      frame.buffer.toI420()
    } catch (_: Throwable) {
      busy.set(false)
      return frame
    }
    if (i420 == null) {
      busy.set(false)
      return frame
    }
    val rotation = frame.rotation
    executor.execute {
      try {
        detect(i420, rotation)
      } catch (_: Throwable) {
        emitEmpty()
      } finally {
        i420.release()
        busy.set(false)
      }
    }
    return frame
  }

  private fun detect(i420: VideoFrame.I420Buffer, rotation: Int) {
    val width = i420.width
    val height = i420.height
    if (width < 16 || height < 16) return emitEmpty()
    val nv21 = i420ToNv21(i420, width, height)
    val image = InputImage.fromByteArray(
      nv21,
      width,
      height,
      rotation,
      InputImage.IMAGE_FORMAT_NV21,
    )
    val faces = Tasks.await(detector.process(image), 180, TimeUnit.MILLISECONDS)
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
      "cx" to cx.toDouble(),
      "cy" to cy.toDouble(),
      "width" to width.toDouble(),
      "height" to height.toDouble(),
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

  private fun i420ToNv21(i420: VideoFrame.I420Buffer, width: Int, height: Int): ByteArray {
    val ySize = width * height
    val nv21 = ByteArray(ySize + ySize / 2)
    copyPlane(i420.dataY, i420.strideY, width, height, nv21, 0)
    var offset = ySize
    val chromaH = height / 2
    val chromaW = width / 2
    val v = i420.dataV
    val u = i420.dataU
    val vStride = i420.strideV
    val uStride = i420.strideU
    for (row in 0 until chromaH) {
      val vRow = row * vStride
      val uRow = row * uStride
      for (col in 0 until chromaW) {
        nv21[offset++] = v.get(vRow + col)
        nv21[offset++] = u.get(uRow + col)
      }
    }
    return nv21
  }

  private fun copyPlane(
    src: ByteBuffer,
    stride: Int,
    width: Int,
    height: Int,
    dst: ByteArray,
    dstOffset: Int,
  ) {
    val dup = src.duplicate()
    var out = dstOffset
    for (row in 0 until height) {
      dup.position(row * stride)
      dup.get(dst, out, width)
      out += width
    }
  }
}
