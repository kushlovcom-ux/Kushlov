/**
 * LiveKit participant-attribute keys used to sync filter state between peers.
 *
 * These strings are wire format. The mobile client already reads and writes
 * them, so they must not be renamed without shipping both sides together.
 */

/** Filter id the publisher has selected. */
export const FILTER_ATTR = 'kushlovFaceFilter';

/** Serialised face box, for clients that draw an overlay approximation. */
export const FACE_BOX_ATTR = 'kushlovFaceBox';

/**
 * '1' when the publisher has already burned the effect into its own pixels.
 * Receivers must then skip their overlay or the effect lands twice.
 */
export const FILTER_BAKED_ATTR = 'kushlovFaceBaked';

/** Data-channel topic for the same payload on clients without attributes. */
export const FILTER_TOPIC = 'kushlov.ff';
