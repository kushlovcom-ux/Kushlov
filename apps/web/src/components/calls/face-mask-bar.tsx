'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { FACE_MASK_ATTR, FACE_MASKS, type FaceMaskId } from '@kushlov/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  onMaskChange?: (id: FaceMaskId) => void;
};

/**
 * Picker for face-only emoji / icon masks during video calls.
 * Selection is published on the local participant so remotes can overlay the same mask.
 */
export function FaceMaskBar({ className, onMaskChange }: Props) {
  const { localParticipant } = useLocalParticipant();
  const [active, setActive] = useState<FaceMaskId>('none');

  useEffect(() => {
    const current = localParticipant.attributes?.[FACE_MASK_ATTR] as FaceMaskId | undefined;
    if (current) setActive(current);
  }, [localParticipant.attributes]);

  const apply = useCallback(
    async (id: FaceMaskId) => {
      setActive(id);
      onMaskChange?.(id);
      try {
        await localParticipant.setAttributes({
          [FACE_MASK_ATTR]: id === 'none' ? '' : id,
        });
      } catch {
        // soft fail — local overlay can still work via parent state
      }
    },
    [localParticipant, onMaskChange],
  );

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-white/45">
        Face mask
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {FACE_MASKS.map((m) => {
          const on = active === m.id;
          return (
            <Button
              key={m.id}
              type="button"
              size="sm"
              variant={on ? 'default' : 'secondary'}
              className="h-9 min-w-9 gap-1 px-2 text-sm"
              title={m.label}
              onClick={() => void apply(m.id)}
            >
              <span className="text-base leading-none">{m.id === 'none' ? '✕' : m.emoji}</span>
              <span className="hidden text-[10px] sm:inline">{m.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
