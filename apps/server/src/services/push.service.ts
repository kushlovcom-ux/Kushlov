/**
 * Backward-compatible re-export. New code should import from
 * `pushNotification.service.ts`.
 */
export {
  sendPushNotification,
  sendExpoPush,
  sendMessageNotification,
  sendLikeNotification,
  sendIncomingAudioCall,
  sendIncomingVideoCall,
  sendMissedCallNotification,
  sendCallCancelledPush,
  sendNotificationToUser,
  sendNotificationToDevices,
} from './pushNotification.service';
