#import "FaceTrackNative.h"
#import <QuartzCore/QuartzCore.h>
#import <CoreImage/CoreImage.h>
#import <CoreVideo/CoreVideo.h>
#import <Vision/Vision.h>
#import <simd/simd.h>
#import <WebRTC/RTCVideoCapturer.h>
#import <WebRTC/RTCVideoFrame.h>
#import <WebRTC/RTCCVPixelBuffer.h>

#if __has_include(<livekit-react-native-webrtc/ProcessorProvider.h>)
#import <livekit-react-native-webrtc/ProcessorProvider.h>
#import <livekit-react-native-webrtc/VideoFrameProcessor.h>
#elif __has_include("ProcessorProvider.h")
#import "ProcessorProvider.h"
#import "VideoFrameProcessor.h"
#endif

static void (^KushlovFaceEmitter)(NSDictionary *);
static dispatch_queue_t KushlovFaceQueue;
static BOOL KushlovFaceBusy = NO;
static CFTimeInterval KushlovFaceLast = 0;

// --- Effect state -----------------------------------------------------------
// Written from the RN thread, read on the capture thread every frame.
static float KushlovBeauty = 0.f;
static float KushlovBrightness = 0.f;
static int KushlovBackground = 0; // 0 none, 1 blur, 2 colour
static float KushlovBgStrength = 0.85f;
static CIColor *KushlovTopColor;
static CIColor *KushlovBottomColor;

static CIContext *KushlovCIContext;
static CVPixelBufferPoolRef KushlovPool;
static size_t KushlovPoolW = 0, KushlovPoolH = 0;

/** Latest person mask from Vision, reused between frames. */
static CIImage *KushlovMask;
static CFTimeInterval KushlovMaskAt = 0;
static BOOL KushlovSegBusy = NO;

static BOOL effectsActive(void) {
  return KushlovBeauty > 0.01f || KushlovBrightness > 0.01f || KushlovBackground != 0;
}

static CIColor *colorFromRGB(NSNumber *packed, CIColor *fallback) {
  if (![packed isKindOfClass:[NSNumber class]]) return fallback;
  NSInteger rgb = [packed integerValue];
  return [CIColor colorWithRed:((rgb >> 16) & 0xFF) / 255.0
                         green:((rgb >> 8) & 0xFF) / 255.0
                          blue:(rgb & 0xFF) / 255.0];
}

/** Reusable output buffers — allocating per frame stalls the capturer. */
static CVPixelBufferRef createOutputBuffer(size_t width, size_t height) {
  if (!KushlovPool || KushlovPoolW != width || KushlovPoolH != height) {
    if (KushlovPool) {
      CVPixelBufferPoolRelease(KushlovPool);
      KushlovPool = NULL;
    }
    NSDictionary *attrs = @{
      (id)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_420YpCbCr8BiPlanarFullRange),
      (id)kCVPixelBufferWidthKey: @(width),
      (id)kCVPixelBufferHeightKey: @(height),
      (id)kCVPixelBufferIOSurfacePropertiesKey: @{},
    };
    if (CVPixelBufferPoolCreate(kCFAllocatorDefault, NULL,
                                (__bridge CFDictionaryRef)attrs, &KushlovPool) != kCVReturnSuccess) {
      KushlovPool = NULL;
      return NULL;
    }
    KushlovPoolW = width;
    KushlovPoolH = height;
  }
  CVPixelBufferRef out = NULL;
  if (CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, KushlovPool, &out) != kCVReturnSuccess) {
    return NULL;
  }
  return out;
}

static void emitEmpty(void) {
  if (KushlovFaceEmitter) {
    KushlovFaceEmitter(@{ @"detected": @NO });
  }
}

static CGPoint regionPoint(VNFaceLandmarkRegion2D *region, CGRect box) {
  const vector_float2 *pts = region.normalizedPoints;
  double sx = 0;
  double sy = 0;
  NSUInteger n = region.pointCount;
  if (n == 0) return CGPointMake(box.origin.x + box.size.width * 0.5, 1.0 - (box.origin.y + box.size.height * 0.5));
  for (NSUInteger i = 0; i < n; i++) {
    sx += pts[i].x;
    sy += pts[i].y;
  }
  double ax = sx / (double)n;
  double ay = sy / (double)n;
  return CGPointMake(box.origin.x + ax * box.size.width, 1.0 - (box.origin.y + ay * box.size.height));
}

/**
 * Refreshes the person mask. Runs on the shared serial queue so inference never
 * blocks the capturer; frames reuse the previous mask meanwhile.
 *
 * Segmentation is deliberately run in the buffer's own orientation so the mask
 * lines up with the pixels 1:1 — rotating it back afterwards costs an extra
 * pass and is where alignment bugs live.
 */
static void updatePersonMask(CVPixelBufferRef pixelBuffer) {
  if (@available(iOS 15.0, *)) {
    VNGeneratePersonSegmentationRequest *request =
        [[VNGeneratePersonSegmentationRequest alloc] init];
    request.qualityLevel = VNGeneratePersonSegmentationRequestQualityLevelBalanced;
    request.outputPixelFormat = kCVPixelFormatType_OneComponent8;
    VNImageRequestHandler *handler =
        [[VNImageRequestHandler alloc] initWithCVPixelBuffer:pixelBuffer options:@{}];
    NSError *error = nil;
    if (![handler performRequests:@[ request ] error:&error]) return;
    VNPixelBufferObservation *observation = request.results.firstObject;
    if (!observation) return;
    CIImage *mask = [CIImage imageWithCVPixelBuffer:observation.pixelBuffer];
    if (!mask) return;
    KushlovMask = mask;
    KushlovMaskAt = CACurrentMediaTime();
  }
}

/** Applies the selected effects and returns a new buffer, or NULL to pass through. */
static CVPixelBufferRef renderEffects(CVPixelBufferRef src) {
  size_t width = CVPixelBufferGetWidth(src);
  size_t height = CVPixelBufferGetHeight(src);
  if (width < 32 || height < 32) return NULL;

  CIImage *source = [CIImage imageWithCVPixelBuffer:src];
  if (!source) return NULL;
  CIImage *result = source;

  // Skin smoothing: noise reduction flattens low-contrast detail (skin) while
  // the sharpness term keeps eyes, brows and lips defined.
  if (KushlovBeauty > 0.01f) {
    CIFilter *reduce = [CIFilter filterWithName:@"CINoiseReduction"];
    [reduce setValue:result forKey:kCIInputImageKey];
    [reduce setValue:@(0.015 + KushlovBeauty * 0.055) forKey:@"inputNoiseLevel"];
    [reduce setValue:@(0.40) forKey:@"inputSharpness"];
    CIImage *smoothed = reduce.outputImage;
    if (smoothed) result = [smoothed imageByCroppingToRect:source.extent];
  }

  if (KushlovBrightness > 0.01f) {
    CIFilter *controls = [CIFilter filterWithName:@"CIColorControls"];
    [controls setValue:result forKey:kCIInputImageKey];
    [controls setValue:@(KushlovBrightness * 0.16) forKey:@"inputBrightness"];
    [controls setValue:@(1.0 + KushlovBrightness * 0.08) forKey:@"inputSaturation"];
    CIImage *lit = controls.outputImage;
    if (lit) result = lit;
  }

  CIImage *mask = KushlovMask;
  if (KushlovBackground != 0 && mask &&
      CACurrentMediaTime() - KushlovMaskAt < 1.2) {
    CIImage *background = nil;
    if (KushlovBackground == 1) {
      CIFilter *blur = [CIFilter filterWithName:@"CIGaussianBlur"];
      [blur setValue:[result imageByClampingToExtent] forKey:kCIInputImageKey];
      [blur setValue:@(MIN(width, height) / 26.0) forKey:@"inputRadius"];
      background = blur.outputImage;
    } else {
      CIFilter *gradient = [CIFilter filterWithName:@"CILinearGradient"];
      [gradient setValue:[CIVector vectorWithX:0 Y:height] forKey:@"inputPoint0"];
      [gradient setValue:[CIVector vectorWithX:0 Y:0] forKey:@"inputPoint1"];
      [gradient setValue:KushlovTopColor ?: [CIColor colorWithRed:0.06 green:0.06 blue:0.09]
                  forKey:@"inputColor0"];
      [gradient setValue:KushlovBottomColor ?: [CIColor colorWithRed:0.02 green:0.02 blue:0.05]
                  forKey:@"inputColor1"];
      CIImage *flat = gradient.outputImage;
      if (flat && KushlovBgStrength < 0.99f) {
        // Keep a little of the real room so a virtual background has depth.
        CIFilter *mix = [CIFilter filterWithName:@"CIDissolveTransition"];
        [mix setValue:result forKey:kCIInputImageKey];
        [mix setValue:flat forKey:kCIInputTargetImageKey];
        [mix setValue:@(KushlovBgStrength) forKey:kCIInputTimeKey];
        flat = mix.outputImage ?: flat;
      }
      background = flat;
    }

    if (background) {
      background = [background imageByCroppingToRect:source.extent];
      CGFloat sx = source.extent.size.width / MAX(mask.extent.size.width, 1.0);
      CGFloat sy = source.extent.size.height / MAX(mask.extent.size.height, 1.0);
      CIImage *scaledMask =
          [mask imageByApplyingTransform:CGAffineTransformMakeScale(sx, sy)];
      CIFilter *blend = [CIFilter filterWithName:@"CIBlendWithMask"];
      [blend setValue:result forKey:kCIInputImageKey];
      [blend setValue:background forKey:kCIInputBackgroundImageKey];
      [blend setValue:scaledMask forKey:kCIInputMaskImageKey];
      CIImage *composited = blend.outputImage;
      if (composited) result = [composited imageByCroppingToRect:source.extent];
    }
  }

  if (result == source) return NULL;

  if (!KushlovCIContext) {
    // Colour management off: this is a realtime video path, not a photo edit.
    KushlovCIContext = [CIContext contextWithOptions:@{
      kCIContextWorkingColorSpace: [NSNull null],
    }];
  }
  CVPixelBufferRef out = createOutputBuffer(width, height);
  if (!out) return NULL;
  [KushlovCIContext render:result toCVPixelBuffer:out];
  return out;
}

@interface KushlovFaceProcessor : NSObject <VideoFrameProcessorDelegate>
@end

@implementation KushlovFaceProcessor

- (RTCVideoFrame *)capturer:(RTCVideoCapturer *)capturer didCaptureVideoFrame:(RTCVideoFrame *)frame {
  // Effects first: this must happen on every frame, not on the sampling tick.
  if (effectsActive() && [frame.buffer isKindOfClass:[RTCCVPixelBuffer class]]) {
    RTCCVPixelBuffer *effectBuf = (RTCCVPixelBuffer *)frame.buffer;
    if (KushlovBackground != 0 && !KushlovSegBusy &&
        CACurrentMediaTime() - KushlovMaskAt > 0.09) {
      KushlovSegBusy = YES;
      CVPixelBufferRef segSource = effectBuf.pixelBuffer;
      CVPixelBufferRetain(segSource);
      if (!KushlovFaceQueue) {
        KushlovFaceQueue = dispatch_queue_create("com.kushlov.facetrack", DISPATCH_QUEUE_SERIAL);
      }
      dispatch_async(KushlovFaceQueue, ^{
        @try {
          updatePersonMask(segSource);
        } @catch (NSException *e) {
          /* keep the previous mask */
        }
        CVPixelBufferRelease(segSource);
        KushlovSegBusy = NO;
      });
    }
    CVPixelBufferRef processed = NULL;
    @try {
      processed = renderEffects(effectBuf.pixelBuffer);
    } @catch (NSException *e) {
      processed = NULL;
    }
    if (processed) {
      RTCCVPixelBuffer *wrapped = [[RTCCVPixelBuffer alloc] initWithPixelBuffer:processed];
      RTCVideoFrame *next = [[RTCVideoFrame alloc] initWithBuffer:wrapped
                                                         rotation:frame.rotation
                                                      timeStampNs:frame.timeStampNs];
      CVPixelBufferRelease(processed);
      frame = next;
    }
  }

  if (KushlovFaceBusy) {
    return frame;
  }
  CFTimeInterval now = CACurrentMediaTime();
  if (now - KushlovFaceLast < 0.08) {
    return frame;
  }
  KushlovFaceLast = now;
  if (!KushlovFaceQueue) {
    KushlovFaceQueue = dispatch_queue_create("com.kushlov.facetrack", DISPATCH_QUEUE_SERIAL);
  }
  if (![frame.buffer isKindOfClass:[RTCCVPixelBuffer class]]) {
    return frame;
  }
  KushlovFaceBusy = YES;
  RTCCVPixelBuffer *rtcBuf = (RTCCVPixelBuffer *)frame.buffer;
  CVPixelBufferRef pixelBuffer = rtcBuf.pixelBuffer;
  CVPixelBufferRetain(pixelBuffer);
  int rotation = (int)frame.rotation;
  dispatch_async(KushlovFaceQueue, ^{
    VNImageOrientation orientation = VNImageOrientationUp;
    switch (rotation) {
      case 90: orientation = VNImageOrientationRight; break;
      case 180: orientation = VNImageOrientationDown; break;
      case 270: orientation = VNImageOrientationLeft; break;
      default: orientation = VNImageOrientationUp; break;
    }
    VNDetectFaceLandmarksRequest *request = [[VNDetectFaceLandmarksRequest alloc] init];
    VNImageRequestHandler *handler =
        [[VNImageRequestHandler alloc] initWithCVPixelBuffer:pixelBuffer orientation:orientation options:@{}];
    NSError *error = nil;
    BOOL ok = [handler performRequests:@[ request ] error:&error];
    CVPixelBufferRelease(pixelBuffer);
    if (!ok || request.results.count == 0) {
      emitEmpty();
      KushlovFaceBusy = NO;
      return;
    }
    VNFaceObservation *best = nil;
    float bestArea = 0;
    for (VNFaceObservation *obs in request.results) {
      float area = obs.boundingBox.size.width * obs.boundingBox.size.height;
      if (area > bestArea) {
        bestArea = area;
        best = obs;
      }
    }
    if (!best) {
      emitEmpty();
      KushlovFaceBusy = NO;
      return;
    }
    // Vision boundingBox is normalized, origin bottom-left.
    CGRect r = best.boundingBox;
    double cx = r.origin.x + r.size.width * 0.5;
    double cy = 1.0 - (r.origin.y + r.size.height * 0.5);
    double width = r.size.width;
    double height = r.size.height;
    NSMutableDictionary *payload = [@{
      @"detected": @YES,
      @"cx": @(cx),
      @"cy": @(cy),
      @"width": @(width),
      @"height": @(height),
      @"rotation": @(0)
    } mutableCopy];
    VNFaceLandmarks2D *marks = best.landmarks;
    if (marks.leftEye && marks.rightEye && marks.leftEye.pointCount > 0 && marks.rightEye.pointCount > 0) {
      CGPoint le = regionPoint(marks.leftEye, r);
      CGPoint re = regionPoint(marks.rightEye, r);
      payload[@"eyeCx"] = @((le.x + re.x) * 0.5);
      payload[@"eyeCy"] = @((le.y + re.y) * 0.5);
      payload[@"eyeW"] = @(hypot(le.x - re.x, le.y - re.y) * 2.6);
    }
    if (marks.nose && marks.nose.pointCount > 0) {
      CGPoint n = regionPoint(marks.nose, r);
      payload[@"noseCx"] = @(n.x);
      payload[@"noseCy"] = @(n.y);
    }
    if (marks.outerLips && marks.outerLips.pointCount > 0) {
      CGPoint m = regionPoint(marks.outerLips, r);
      payload[@"mouthCx"] = @(m.x);
      payload[@"mouthCy"] = @(m.y);
    }
    payload[@"foreheadCx"] = @(cx);
    payload[@"foreheadCy"] = @(cy - height * 0.42);
    if (KushlovFaceEmitter) {
      KushlovFaceEmitter(payload);
    }
    KushlovFaceBusy = NO;
  });
  return frame;
}

@end

@implementation KushlovFaceTrackBridge

+ (void)setEmitter:(void (^)(NSDictionary *payload))emitter {
  KushlovFaceEmitter = [emitter copy];
}

+ (void)setEffectConfig:(NSDictionary *)config {
  if (![config isKindOfClass:[NSDictionary class]]) return;
  KushlovBeauty = MAX(0.f, MIN(1.f, [config[@"beauty"] floatValue]));
  KushlovBrightness = MAX(0.f, MIN(1.f, [config[@"brightness"] floatValue]));
  NSString *mode = config[@"background"];
  KushlovBackground = [mode isEqualToString:@"blur"] ? 1 : [mode isEqualToString:@"color"] ? 2 : 0;
  NSNumber *strength = config[@"backgroundStrength"];
  KushlovBgStrength = strength ? MAX(0.f, MIN(1.f, [strength floatValue])) : 0.85f;
  KushlovTopColor = colorFromRGB(config[@"topColor"],
                                 [CIColor colorWithRed:0.06 green:0.06 blue:0.09]);
  KushlovBottomColor = colorFromRGB(config[@"bottomColor"],
                                    [CIColor colorWithRed:0.02 green:0.02 blue:0.05]);
  if (KushlovBackground == 0) {
    KushlovMask = nil;
    KushlovMaskAt = 0;
  }
}

+ (void)registerProcessor {
  static KushlovFaceProcessor *processor;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    @try {
      processor = [KushlovFaceProcessor new];
      [ProcessorProvider addProcessor:processor forName:@"kushlovFace"];
    } @catch (NSException *exception) {
      processor = nil;
    }
  });
}

@end
