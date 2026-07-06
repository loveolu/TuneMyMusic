import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'accent' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium font-body',
        variant === 'default' && 'bg-elevated text-text-secondary border border-border',
        variant === 'success' && 'bg-success/10 text-success border border-success/20',
        variant === 'warning' && 'bg-warning/10 text-warning border border-warning/20',
        variant === 'error' && 'bg-error/10 text-error border border-error/20',
        variant === 'accent' && 'bg-accent text-base',
        variant === 'outline' && 'border border-border text-text-secondary bg-transparent',
        className,
      )}
      {...props}
    />
  );
}
