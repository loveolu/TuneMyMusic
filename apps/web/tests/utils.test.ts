import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (className merger)', () => {
  it('concatenates plain class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values silently', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('honors clsx conditional object syntax', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('lets later Tailwind classes win over earlier ones (twMerge behavior)', () => {
    // p-2 must be replaced by p-4 because both target the `padding` shorthand.
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('keeps non-conflicting Tailwind classes side-by-side', () => {
    expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500');
  });

  it('flattens nested arrays', () => {
    expect(cn(['a', ['b', ['c']]], 'd')).toBe('a b c d');
  });
});
