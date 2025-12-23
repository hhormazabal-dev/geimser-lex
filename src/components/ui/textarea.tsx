import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[100px] w-full rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass)] px-4 py-3 text-sm text-foreground/80 shadow-inner transition-all placeholder:text-foreground/40 focus-visible:border-primary/50 focus-visible:bg-[color:var(--glass-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
