#import <Foundation/Foundation.h>

@interface KushlovFaceTrackBridge : NSObject
+ (void)registerProcessor;
+ (void)setEmitter:(void (^)(NSDictionary *payload))emitter;
@end
