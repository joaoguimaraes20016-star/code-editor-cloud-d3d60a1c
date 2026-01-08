import type { CSSProperties, ReactNode } from 'react';

import type { FunnelLayoutMetrics } from '../layout/funnelLayout';

export type StepStackMode = 'runtime' | 'preview';

export interface StepStackProps {
  children: ReactNode;
  layout: FunnelLayoutMetrics;
  mode?: StepStackMode;
}

export function StepStack({ children, layout, mode = 'runtime' }: StepStackProps) {
  const paddingStyle = {
    '--funnel-stack-padding-top': `${layout.gutters.top}px`,
    '--funnel-stack-padding-bottom': `${layout.gutters.bottom}px`,
    '--funnel-stack-padding-inline': `${layout.gutters.horizontal}px`,
  } as CSSProperties;

  return (
    <div
      className="funnel-step-stack"
      data-intent={layout.intent}
      data-width={layout.width}
      data-mode={mode}
      style={paddingStyle}
    >
      <div className="funnel-step-stack__inner">{children}</div>
    </div>
  );
}
