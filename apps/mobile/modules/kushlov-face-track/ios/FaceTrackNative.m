#import "FaceTrackNative.h"
#import <QuartzCore/QuartzCore.h>
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

@interface KushlovFaceProcessor : NSObject <VideoFrameProcessorDelegate>
@end

@implementation KushlovFaceProcessor

- (RTCVideoFrame *)capturer:(RTCVideoCapturer *)capturer didCaptureVideoFrame:(RTCVideoFrame *)frame {
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

+ (void)registerProcessor {
  static KushlovFaceProcessor *processor;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    processor = [KushlovFaceProcessor new];
    [ProcessorProvider addProcessor:processor forName:@"kushlovFace"];
  });
}

@end
