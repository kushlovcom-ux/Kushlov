import { CallType } from '@kushlov/types';

/** Fire a global start-call event handled by CallOverlay (keeps LiveKit out of page bundles). */
export function startCall(
  type: CallType,
  calleeId: string,
  peerName: string,
  opts?: {
    peerIsHost?: boolean;
    peerRole?: string;
    peerHostApproved?: boolean;
    /** Extra participant ids for group start (1B), not including calleeId. */
    participantIds?: string[];
    /** Park this Ongoing call and start a consult to callee. */
    fromCallId?: string;
  },
) {
  window.dispatchEvent(
    new CustomEvent('kushlov:start-call', {
      detail: {
        type,
        calleeId,
        peerName,
        peerIsHost: opts?.peerIsHost,
        peerRole: opts?.peerRole,
        peerHostApproved: opts?.peerHostApproved,
        participantIds: opts?.participantIds,
        fromCallId: opts?.fromCallId,
      },
    }),
  );
}
