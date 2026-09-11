package com.kushlov.facetrack

/** Background treatment applied to the segmented non-person pixels. */
internal enum class BackgroundMode {
  NONE,
  BLUR,
  COLOR,
}

/**
 * Immutable view of the effect settings for one frame. Taken once per frame so
 * a JS update mid-render cannot change the parameters half way through.
 */
internal data class EffectSnapshot(
  val beauty: Float,
  val brightness: Float,
  val background: BackgroundMode,
  val topColor: Int,
  val bottomColor: Int,
  val backgroundStrength: Float,
) {
  val needsSegmentation: Boolean
    get() = background != BackgroundMode.NONE

  val active: Boolean
    get() = beauty > 0.01f || brightness > 0.01f || background != BackgroundMode.NONE
}

/**
 * Effect parameters pushed from JS. Written from the RN thread and read from
 * the capturer thread every frame, so every field is volatile and reads go
 * through [snapshot].
 */
internal object FaceEffectConfig {
  @Volatile private var beauty: Float = 0f
  @Volatile private var brightness: Float = 0f
  @Volatile private var background: BackgroundMode = BackgroundMode.NONE
  @Volatile private var topColor: Int = 0x101018
  @Volatile private var bottomColor: Int = 0x05050C
  @Volatile private var backgroundStrength: Float = 0.85f

  fun update(
    beauty: Float,
    brightness: Float,
    background: String,
    topColor: Int,
    bottomColor: Int,
    backgroundStrength: Float,
  ) {
    this.beauty = beauty.coerceIn(0f, 1f)
    this.brightness = brightness.coerceIn(0f, 1f)
    this.background = when (background) {
      "blur" -> BackgroundMode.BLUR
      "color" -> BackgroundMode.COLOR
      else -> BackgroundMode.NONE
    }
    this.topColor = topColor
    this.bottomColor = bottomColor
    this.backgroundStrength = backgroundStrength.coerceIn(0f, 1f)
    if (this.background == BackgroundMode.NONE) SegmentationCache.clear()
  }

  fun reset() = update(0f, 0f, "none", 0x101018, 0x05050C, 0.85f)

  fun snapshot(): EffectSnapshot =
    EffectSnapshot(beauty, brightness, background, topColor, bottomColor, backgroundStrength)
}

/**
 * Latest selfie-segmentation mask. Segmentation runs off the capturer thread,
 * so frames reuse the most recent mask rather than blocking on inference — a
 * frame or two of lag on the background is invisible next to a stalled camera.
 */
internal object SegmentationCache {
  @Volatile private var mask: FloatArray? = null
  @Volatile private var maskWidth: Int = 0
  @Volatile private var maskHeight: Int = 0
  @Volatile private var rotation: Int = 0
  @Volatile private var updatedAt: Long = 0L

  /** Older than this and the mask no longer matches where the person is. */
  private const val STALE_MS = 1_200L

  fun store(values: FloatArray, width: Int, height: Int, rotationDegrees: Int) {
    mask = values
    maskWidth = width
    maskHeight = height
    rotation = rotationDegrees
    updatedAt = System.currentTimeMillis()
  }

  fun clear() {
    mask = null
    maskWidth = 0
    maskHeight = 0
    updatedAt = 0L
  }

  /** Null when segmentation has not produced a usable mask yet. */
  fun current(): Mask? {
    val values = mask ?: return null
    if (maskWidth <= 0 || maskHeight <= 0) return null
    if (System.currentTimeMillis() - updatedAt > STALE_MS) return null
    return Mask(values, maskWidth, maskHeight, rotation)
  }

  internal class Mask(
    val values: FloatArray,
    val width: Int,
    val height: Int,
    val rotation: Int,
  ) {
    /**
     * Index into [values] for a pixel in unrotated buffer space. ML Kit returns
     * the mask already upright, so buffer coordinates are rotated to match
     * before sampling. Returning the index rather than the confidence lets the
     * caller also derive the vertical position for background gradients without
     * repeating the rotation maths.
     */
    fun indexAt(bx: Int, by: Int, bufferW: Int, bufferH: Int): Int {
      val ux: Int
      val uy: Int
      val uprightW: Int
      val uprightH: Int
      when (rotation) {
        90 -> {
          uprightW = bufferH
          uprightH = bufferW
          ux = uprightW - 1 - by
          uy = bx
        }
        180 -> {
          uprightW = bufferW
          uprightH = bufferH
          ux = uprightW - 1 - bx
          uy = uprightH - 1 - by
        }
        270 -> {
          uprightW = bufferH
          uprightH = bufferW
          ux = by
          uy = uprightH - 1 - bx
        }
        else -> {
          uprightW = bufferW
          uprightH = bufferH
          ux = bx
          uy = by
        }
      }
      if (uprightW <= 0 || uprightH <= 0) return 0
      val mx = (ux.toLong() * width / uprightW).toInt().coerceIn(0, width - 1)
      val my = (uy.toLong() * height / uprightH).toInt().coerceIn(0, height - 1)
      return my * width + mx
    }
  }
}

/** Rec.601 luma/chroma for a packed 0xRRGGBB colour, matching I420 range. */
internal class YuvColor(rgb: Int) {
  val y: Int
  val u: Int
  val v: Int

  init {
    val r = (rgb shr 16) and 0xFF
    val g = (rgb shr 8) and 0xFF
    val b = rgb and 0xFF
    y = (0.299f * r + 0.587f * g + 0.114f * b).toInt().coerceIn(0, 255)
    u = (-0.169f * r - 0.331f * g + 0.5f * b + 128f).toInt().coerceIn(0, 255)
    v = (0.5f * r - 0.419f * g - 0.081f * b + 128f).toInt().coerceIn(0, 255)
  }
}
