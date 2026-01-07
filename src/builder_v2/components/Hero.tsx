import type { CSSProperties, ReactNode } from 'react';

type HeroProps = {
  headline?: string;
  subheadline?: string;
  backgroundColor?: string;
  children?: ReactNode;
};

export function Hero({
  headline = 'Hero headline',
  subheadline = 'Hero subheadline',
  backgroundColor = '#1f2937',
  children,
}: HeroProps) {
  return (
    <section
      className="builder-v2-component builder-v2-component--hero"
      style={{ '--builder-v2-hero-bg': backgroundColor } as CSSProperties}
    >
      <div className="builder-v2-component--hero-content">
        <h2 className="builder-v2-component--hero-headline">{headline}</h2>
        <p className="builder-v2-component--hero-subheadline">{subheadline}</p>
        {children}
      </div>
    </section>
  );
}
