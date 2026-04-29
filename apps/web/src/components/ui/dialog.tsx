'use client';
import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** Optional accessible description rendered for screen readers only. */
  description?: string;
}

/**
 * Modal dialog with keyboard + screen-reader accessibility:
 *
 * - `role='dialog'` + `aria-modal='true'` so AT announces it as a modal
 *   that takes focus from the rest of the page.
 * - Esc closes (matches platform convention; the X click button still works).
 * - On open, focus is moved to the first focusable element inside the
 *   dialog, and on close it returns to the element that was focused before
 *   the dialog opened. Without this, keyboard users are dropped at the top
 *   of the page when the dialog closes.
 * - Body scroll is locked while open so the background doesn't jump under
 *   the user.
 */
export function Dialog({ open, onClose, title, children, className, description }: DialogProps) {
  const titleId = useId();
  const descId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Esc to close + body scroll lock + focus management.
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Defer focus until after the open animation kicks off so RAF actually
    // sees the element in the DOM.
    const focusTimer = window.setTimeout(() => {
      const root = contentRef.current;
      if (!root) return;
      const first = root.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (first ?? root).focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      // Restore focus to whatever was focused before we opened.
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            className={cn('fixed inset-0 z-50 flex items-center justify-center p-4')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              ref={contentRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descId : undefined}
              tabIndex={-1}
              className={cn(
                'relative w-full max-w-lg rounded-2xl bg-elevated border border-border shadow-2xl outline-none',
                className,
              )}
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between p-6 border-b border-border">
                {title && (
                  <h2 id={titleId} className="text-lg font-display font-bold text-text-primary">
                    {title}
                  </h2>
                )}
                {description && (
                  <span id={descId} className="sr-only">
                    {description}
                  </span>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="ml-auto p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="p-6">{children}</div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
