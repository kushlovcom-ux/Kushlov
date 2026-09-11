package com.kushlov.facetrack

import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.Segmenter
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessor
import org.webrtc.JavaI420Buffer
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoFrame
import java.nio.ByteBuffer
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * LiveKit camera frame processor.
 *
 * Runs face detection and selfie segmentation off-thread, and — when the user
 * has picked a beauty or background effect — rewrites the frame in place so the
 * effect is baked into what remotes actually receive. With no effect selected
 * the frame is passed through untouched, which is the original behaviour.
 *
 * The extra retain() on the pass-through path offsets a known double-release in
 * react-native-webrtc's VideoEffectProcessor when the same instance is returned.
 */
internal class FaceFrameProcessor : VideoFrameProcessor {
  private val executor = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  private var lastEmit = 0L
  private var detector: FaceDetector? = null
  private var segmenter: Segmenter? = null

  // Scratch buffers, reused across frames so a 30fps call does not churn the heap.
  private var yPlane: ByteArray = ByteArray(0)
  private var uPlane: ByteArray = ByteArray(0)
  private var vPlane: ByteArray = ByteArray(0)
  private var scratchA: IntArray = IntArray(0)
  private var scratchB: IntArray = IntArray(0)
  private var blurY: IntArray = IntArray(0)

  // Rolling render cost. Effects switch themselves off on devices that cannot
  // keep up rather than degrading the call itself.
  private var renderSamples = 0
  private var renderTotalMs = 0L
  private var degraded = false

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

  private fun segmenter(): Segmenter? {
    val existing = segmenter
    if (existing != null) return existing
    return try {
      Segmentation.getClient(
        SelfieSegmenterOptions.Builder()
          .setDetectorMode(SelfieSegmenterOptions.STREAM_MODE)
          .build(),
      ).also { segmenter = it }
    } catch (_: Throwable) {
      null
    }
  }

  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    val config = FaceEffectConfig.snapshot()
    scheduleAnalysis(frame, config)

    if (!config.active || degraded) {
      frame.retain()
      return frame
    }

    val started = System.nanoTime()
    val rendered = try {
      render(frame, config)
    } catch (_: Throwable) {
      null
    }
    if (rendered == null) {
      frame.retain()
      return frame
    }
    trackRenderCost((System.nanoTime() - started) / 1_000_000L)
    return rendered
  }

  /** Disable effects rather than let a slow device stall the capturer. */
  private fun trackRenderCost(millis: Long) {
    renderTotalMs += millis
    renderSamples += 1
    if (renderSamples < 45) return
    val average = renderTotalMs / renderSamples
    renderSamples = 0
    renderTotalMs = 0
    if (average > 26) {
      degraded = true
      SegmentationCache.clear()
    }
  }

  // ---------------------------------------------------------------- analysis

  private fun scheduleAnalysis(frame: VideoFrame, config: EffectSnapshot) {
    try {
      val now = System.currentTimeMillis()
      val interval = if (config.needsSegmentation) 90L else 160L
      if (now - lastEmit < interval || !busy.compareAndSet(false, true)) return
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
        return
      }
      val rotation = frame.rotation
      executor.execute {
        try {
          analyze(i420, rotation, config)
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
    } catch (_: Throwable) {
      busy.set(false)
    }
  }

  private fun analyze(i420: VideoFrame.I420Buffer, rotation: Int, config: EffectSnapshot) {
    val srcW = i420.width
    val srcH = i420.height
    if (srcW < 16 || srcH < 16) return emitEmpty()
    val step = if (srcW * srcH > 640 * 480) 2 else 1
    val width = (srcW / step).let { it - it % 2 }.coerceAtLeast(16)
    val height = (srcH / step).let { it - it % 2 }.coerceAtLeast(16)
    // One NV21 conversion feeds both detectors.
    val nv21 = i420ToNv21(i420, srcW, srcH, width, height, step)
    val image = InputImage.fromByteArray(
      nv21,
      width,
      height,
      rotation,
      InputImage.IMAGE_FORMAT_NV21,
    )
    if (config.needsSegmentation) segment(image, rotation)
    detectFace(image, width, height, rotation)
  }

  private fun segment(image: InputImage, rotation: Int) {
    val client = segmenter() ?: return
    val mask = try {
      com.google.android.gms.tasks.Tasks.await(
        client.process(image),
        260,
        java.util.concurrent.TimeUnit.MILLISECONDS,
      )
    } catch (_: Throwable) {
      return
    }
    try {
      val buffer = mask.buffer
      val width = mask.width
      val height = mask.height
      if (width <= 0 || height <= 0) return
      val values = FloatArray(width * height)
      buffer.rewind()
      // ML Kit reuses this buffer for the next frame, so copy before caching.
      for (i in values.indices) values[i] = buffer.float
      buffer.rewind()
      SegmentationCache.store(values, width, height, rotation)
    } catch (_: Throwable) {
      /* keep the previous mask */
    }
  }

  private fun detectFace(image: InputImage, width: Int, height: Int, rotation: Int) {
    val client = detector() ?: return
    val faces = try {
      com.google.android.gms.tasks.Tasks.await(
        client.process(image),
        220,
        java.util.concurrent.TimeUnit.MILLISECONDS,
      )
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

  // ----------------------------------------------------------------- render

  private fun render(frame: VideoFrame, config: EffectSnapshot): VideoFrame? {
    val src = try {
      frame.buffer.toI420()
    } catch (_: Throwable) {
      null
    } ?: return null

    var out: JavaI420Buffer? = null
    try {
      val w = src.width
      val h = src.height
      // Guard against 1080p+ capture on a device that cannot afford the passes.
      if (w < 32 || h < 32 || w * h > 1_500_000) return null

      val chromaW = (w + 1) / 2
      val chromaH = (h + 1) / 2
      ensureBuffers(w * h, chromaW * chromaH)

      readPlane(src.dataY, src.strideY, w, h, yPlane)
      readPlane(src.dataU, src.strideU, chromaW, chromaH, uPlane)
      readPlane(src.dataV, src.strideV, chromaW, chromaH, vPlane)

      val mask = if (config.needsSegmentation) SegmentationCache.current() else null
      if (mask != null) applyBackground(w, h, chromaW, chromaH, mask, config)
      if (config.beauty > 0.01f || config.brightness > 0.01f) applyBeauty(w, h, config)

      val dst = JavaI420Buffer.allocate(w, h)
      out = dst
      writePlane(dst.dataY, dst.strideY, w, h, yPlane)
      writePlane(dst.dataU, dst.strideU, chromaW, chromaH, uPlane)
      writePlane(dst.dataV, dst.strideV, chromaW, chromaH, vPlane)
      out = null
      return VideoFrame(dst, frame.rotation, frame.timestampNs)
    } catch (_: Throwable) {
      out?.release()
      return null
    } finally {
      try {
        src.release()
      } catch (_: Throwable) {
        /* already released */
      }
    }
  }

  private fun ensureBuffers(luma: Int, chroma: Int) {
    if (yPlane.size < luma) yPlane = ByteArray(luma)
    if (uPlane.size < chroma) uPlane = ByteArray(chroma)
    if (vPlane.size < chroma) vPlane = ByteArray(chroma)
    if (scratchA.size < luma) scratchA = IntArray(luma)
    if (scratchB.size < luma) scratchB = IntArray(luma)
    if (blurY.size < luma) blurY = IntArray(luma)
  }

  /**
   * Edge-aware skin smoothing. Only pixels close to their neighbourhood average
   * are pulled toward it, so skin flattens while eyes, brows and hair keep their
   * contrast — a plain blur here looks like a smeared lens.
   */
  private fun applyBeauty(w: Int, h: Int, config: EffectSnapshot) {
    val radius = max(1, min(w, h) / 130)
    boxBlur(yPlane, w, h, radius, scratchA, scratchB)
    val strength = config.beauty
    val gain = 1f + config.brightness * 0.10f
    val lift = config.brightness * 26f
    val edgeThreshold = 26
    for (i in 0 until w * h) {
      val original = yPlane[i].toInt() and 0xFF
      val smoothed = scratchB[i]
      val delta = smoothed - original
      var value =
        if (abs(delta) < edgeThreshold) original + delta * strength else original.toFloat()
      value = value * gain + lift
      yPlane[i] = value.toInt().coerceIn(0, 255).toByte()
    }
  }

  /**
   * Blur or recolour everything the segmenter did not mark as the person. The
   * mask is sampled per pixel with a soft transition band so the silhouette does
   * not shimmer between frames.
   */
  private fun applyBackground(
    w: Int,
    h: Int,
    chromaW: Int,
    chromaH: Int,
    mask: SegmentationCache.Mask,
    config: EffectSnapshot,
  ) {
    val strength = config.backgroundStrength
    val blurring = config.background == BackgroundMode.BLUR
    if (blurring) {
      boxBlur(yPlane, w, h, max(3, min(w, h) / 18), scratchA, blurY)
    }
    val top = YuvColor(config.topColor)
    val bottom = YuvColor(config.bottomColor)

    for (y in 0 until h) {
      val row = y * w
      for (x in 0 until w) {
        val index = mask.indexAt(x, y, w, h)
        val weight = backgroundWeight(mask.values[index]) * strength
        if (weight <= 0.001f) continue
        val i = row + x
        val original = yPlane[i].toInt() and 0xFF
        val target = if (blurring) {
          blurY[i]
        } else {
          val t = (index / mask.width).toFloat() / max(1, mask.height)
          (top.y + (bottom.y - top.y) * t).toInt()
        }
        yPlane[i] = (original + (target - original) * weight).toInt().coerceIn(0, 255).toByte()
      }
    }

    // Chroma is half resolution; sample the mask at the matching luma pixel.
    for (cy in 0 until chromaH) {
      val row = cy * chromaW
      val ly = min(h - 1, cy * 2)
      for (cx in 0 until chromaW) {
        val lx = min(w - 1, cx * 2)
        val index = mask.indexAt(lx, ly, w, h)
        val weight = backgroundWeight(mask.values[index]) * strength
        if (weight <= 0.001f) continue
        val i = row + cx
        val targetU: Int
        val targetV: Int
        if (blurring) {
          // Desaturating the background reads as depth of field without a
          // second pair of blur passes over the chroma planes.
          targetU = 128
          targetV = 128
        } else {
          val t = (index / mask.width).toFloat() / max(1, mask.height)
          targetU = (top.u + (bottom.u - top.u) * t).toInt()
          targetV = (top.v + (bottom.v - top.v) * t).toInt()
        }
        val u = uPlane[i].toInt() and 0xFF
        val v = vPlane[i].toInt() and 0xFF
        val chromaWeight = if (blurring) weight * 0.65f else weight
        uPlane[i] = (u + (targetU - u) * chromaWeight).toInt().coerceIn(0, 255).toByte()
        vPlane[i] = (v + (targetV - v) * chromaWeight).toInt().coerceIn(0, 255).toByte()
      }
    }
  }

  /** Foreground confidence to background opacity, with a soft edge band. */
  private fun backgroundWeight(foreground: Float): Float {
    val background = 1f - foreground
    return when {
      background <= 0.40f -> 0f
      background >= 0.60f -> 1f
      else -> (background - 0.40f) / 0.20f
    }
  }

  /** Separable running-sum box blur — cost is independent of the radius. */
  private fun boxBlur(src: ByteArray, w: Int, h: Int, radius: Int, tmp: IntArray, out: IntArray) {
    val diameter = radius * 2 + 1
    for (row in 0 until h) {
      val base = row * w
      var sum = 0
      for (offset in -radius..radius) {
        sum += src[base + offset.coerceIn(0, w - 1)].toInt() and 0xFF
      }
      for (col in 0 until w) {
        tmp[base + col] = sum / diameter
        val add = src[base + min(w - 1, col + radius + 1)].toInt() and 0xFF
        val remove = src[base + max(0, col - radius)].toInt() and 0xFF
        sum += add - remove
      }
    }
    for (col in 0 until w) {
      var sum = 0
      for (offset in -radius..radius) {
        sum += tmp[offset.coerceIn(0, h - 1) * w + col]
      }
      for (row in 0 until h) {
        out[row * w + col] = sum / diameter
        val add = tmp[min(h - 1, row + radius + 1) * w + col]
        val remove = tmp[max(0, row - radius) * w + col]
        sum += add - remove
      }
    }
  }

  private fun readPlane(src: ByteBuffer, stride: Int, w: Int, h: Int, out: ByteArray) {
    var index = 0
    for (row in 0 until h) {
      val base = row * stride
      for (col in 0 until w) out[index++] = src.get(base + col)
    }
  }

  private fun writePlane(dst: ByteBuffer, stride: Int, w: Int, h: Int, data: ByteArray) {
    var index = 0
    for (row in 0 until h) {
      val base = row * stride
      for (col in 0 until w) dst.put(base + col, data[index++])
    }
  }

  // ------------------------------------------------------------------ events

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
