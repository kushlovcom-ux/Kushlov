import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@kushlov/ui';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-brand-gradient text-white',
        secondary: 'bg-white/10 text-white/80',
        success: 'bg-emerald-500/20 text-emerald-300',
        warning: 'bg-amber-500/20 text-amber-300',
        destructive: 'bg-red-500/20 text-red-300',
        outline: 'border border-white/20 text-white/80',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
