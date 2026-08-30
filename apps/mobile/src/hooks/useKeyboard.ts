import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Android has been edge-to-edge since API 35, so `adjustResize` no longer
 * shrinks the window when the keyboard opens and screens have to account for
 * the IME themselves. This reports the on-screen keyboard height (0 when
 * hidden) so a composer can drop its safe-area padding while the keyboard
 * covers the navigation bar.
 */
export function useKeyboard() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS fires the `Will` events early enough to animate alongside the
    // keyboard; Android only emits the `Did` pair.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { height, visible: height > 0 };
}
