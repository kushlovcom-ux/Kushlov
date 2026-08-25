import { useEffect } from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

const RINGTONE = require('../../assets/sounds/incoming-call.wav');

/** Loop the incoming-call ringtone while the incoming-call UI is visible. */
export function useCallRingtone(enabled: boolean) {
  const player = useAudioPlayer(RINGTONE);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!enabled) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      player.loop = true;
      player.volume = 0.85;
      if (typeof player.seekTo === 'function') {
        void player.seekTo(0);
      }
      player.play();
    } catch {
      /* ignore */
    }
    return () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, player]);
}
