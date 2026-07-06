'use client';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ProgressProps {
  value: number; // 0-100
  className?: string;
  showLabel?: boolean;
  color?: string;
}

export function Progress({ value, className, showLabel, color = '#E8FF47' }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    // Decorative track — the parent <div role='progressbar'> with aria-valuenow
    // is what AT reads. We mark this aria-hidden so the percentage isn't
    // double-announced.
    <div
      aria-hidden="true"
      className={cn('relative h-2 w-full rounded-full bg-elevated overflow-hidden', className)}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: '0%' }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {showLabel && (
        <span className="absolute right-0 top-[-20px] text-xs text-text-secondary font-mono">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
