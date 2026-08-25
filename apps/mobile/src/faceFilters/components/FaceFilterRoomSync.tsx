import React, { useEffect } from 'react';
import { RoomEvent, type Participant, type Room } from 'livekit-client';
import { FACE_FILTER_ATTR, FACE_FILTER_BOX_ATTR, FACE_FILTER_TOPIC } from '../types';
import { parseFaceBox } from '../layout';
import { useFaceFilterStore } from '../hooks/useFaceFilter';

const decoder = new TextDecoder();

type FilterPacket = { t?: string; id?: string; box?: string; from?: string };

function applyFromParticipant(
  p: Participant,
  setRemoteFilter: (identity: string, id: string, box?: ReturnType<typeof parseFaceBox>) => void,
) {
  if (p.isLocal || !p.identity) return;
  setRemoteFilter(
    p.identity,
    p.attributes?.[FACE_FILTER_ATTR] || '',
    parseFaceBox(p.attributes?.[FACE_FILTER_BOX_ATTR]),
  );
}

/**
 * Keeps remote filter ids in the store from attributes + data packets,
 * including participants who joined before this client.
 */
export function FaceFilterRoomSync({ room }: { room: Room | null }) {
  const setRemoteFilter = useFaceFilterStore((s) => s.setRemoteFilter);
  const clearRemoteFilters = useFaceFilterStore((s) => s.clearRemoteFilters);

  useEffect(() => {
    if (!room) return;

    const hydrate = () => {
      room.remoteParticipants.forEach((p) => applyFromParticipant(p, setRemoteFilter));
    };

    const onParticipant = (participant: Participant) => {
      applyFromParticipant(participant, setRemoteFilter);
    };

    const onAttr = (_changed: Record<string, string>, participant: Participant) => {
      applyFromParticipant(participant, setRemoteFilter);
    };

    const onData = (
      payload: Uint8Array,
      participant?: Participant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== FACE_FILTER_TOPIC) return;
      if (participant?.isLocal) return;
      try {
        const msg = JSON.parse(decoder.decode(payload)) as FilterPacket;
        if (msg?.t !== 'ff') return;
        const identity = participant?.identity || msg.from;
        if (!identity) return;
        setRemoteFilter(identity, msg.id || '', parseFaceBox(msg.box));
      } catch {
        /* ignore */
      }
    };

    hydrate();
    room.on(RoomEvent.ParticipantConnected, onParticipant);
    room.on(RoomEvent.ParticipantAttributesChanged, onAttr);
    room.on(RoomEvent.DataReceived, onData);
    const poll = setInterval(hydrate, 1500);

    return () => {
      clearInterval(poll);
      room.off(RoomEvent.ParticipantConnected, onParticipant);
      room.off(RoomEvent.ParticipantAttributesChanged, onAttr);
      room.off(RoomEvent.DataReceived, onData);
      clearRemoteFilters();
    };
  }, [room, setRemoteFilter, clearRemoteFilters]);

  return null;
}
