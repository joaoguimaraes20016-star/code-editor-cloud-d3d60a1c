import type { CSSProperties, ReactNode } from 'react';

type ContainerProps = {
  gap?: number;
  children?: ReactNode;
};

export function Container({ gap = 12, children }: ContainerProps) {
  return (
    <div
      className="builder-v2-component builder-v2-component--container"
      style={{
        '--builder-v2-gap': `${gap}px`,
        maxWidth: '672px',
        width: '100%',
        margin: '0 auto',
        alignItems: 'center',
      } as CSSProperties}
    >
      {children}
    </div>
  );
}
