import * as React from 'react';
import { cn } from './cn';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  withWordmark?: boolean;
}

/**
 * Kushlov brandmark. Renders the gradient "K" glyph and optional wordmark.
 * The raster logo (kush.png) is served from /kush.png in the web app's public dir.
 */
export function Logo({ size = 36, withWordmark = true, className, ...rest }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)} {...rest}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/kush.png"
        alt="Kushlov"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain' }}
        draggable={false}
      />
      {withWordmark && (
        <span className="bg-gradient-to-r from-brand-pink via-brand-blue to-brand-orange bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          Kushlov
        </span>
      )}
    </div>
  );
}
