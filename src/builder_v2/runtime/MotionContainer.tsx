/**
 * MotionContainer centralizes all runtime motion behavior so we can enable or
 * disable animation without touching every call site. It intentionally keeps
 * the animation subtle to maintain parity with the legacy renderer.
 */
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export type MotionMode = 'off' | 'preview' | 'runtime';

export interface MotionContainerProps {
  children: ReactNode;
  className?: string;
  motionMode?: MotionMode;
}

const MOTION_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const MOTION_TRANSITION = {
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1] as const,
};

export function MotionContainer({
  children,
  className,
  motionMode = 'off',
}: MotionContainerProps) {
  const prefersReducedMotion = useReducedMotion();
  const resolvedClass = className ?? 'runtime-motion-container';
  const shouldAnimate = motionMode !== 'off' && !prefersReducedMotion;

  if (!shouldAnimate) {
    return (
      <div className={resolvedClass} data-motion-mode="off">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={resolvedClass}
      data-motion-mode={motionMode}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={MOTION_VARIANTS}
      transition={MOTION_TRANSITION}
    >
      {children}
    </motion.div>
  );
}
