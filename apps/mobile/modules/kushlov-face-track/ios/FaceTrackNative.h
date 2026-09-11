#import <Foundation/Foundation.h>

@interface KushlovFaceTrackBridge : NSObject
+ (void)registerProcessor;
+ (void)setEmitter:(void (^)(NSDictionary *payload))emitter;
/**
 * Beauty / background parameters for the capture pipeline. Keys mirror the
 * Android module: beauty, brightness, background ("none"|"blur"|"color"),
 * topColor, bottomColor, backgroundStrength.
 */
+ (void)setEffectConfig:(NSDictionary *)config;
@end
