import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-medium tracking-tight transition-all focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-[color:var(--glass-border)] bg-[color:var(--glass)] text-foreground/80 shadow-sm backdrop-blur-md',
        secondary:
          'border-[color:var(--glass-border)] bg-white/30 text-foreground/70',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/90',
        outline: 'border-[color:var(--glass-border)] text-foreground/70',
        success:
          'border-[hsl(var(--success)/0.18)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
        warning:
          'border-[hsl(var(--warning)/0.22)] bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]',
        info:
          'border-[hsl(var(--info)/0.18)] bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))]',
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
