import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-medium tracking-tight transition-all focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-white/30 bg-white/70 text-foreground/80 shadow-sm backdrop-blur-md',
        secondary:
          'border-white/20 bg-white/30 text-foreground/70',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/90',
        outline: 'border-white/40 text-foreground/70',
        success:
          'border-transparent bg-emerald-500/15 text-emerald-500',
        warning:
          'border-transparent bg-amber-400/20 text-amber-600',
        info:
          'border-transparent bg-sky-500/15 text-sky-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
