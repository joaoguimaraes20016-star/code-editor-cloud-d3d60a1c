import type { LegacySnapshotPayload } from '../legacy/legacyAdapter';
import { FunnelRenderer } from '../../components/funnel-public/FunnelRenderer';

export type LegacyFunnelProps = LegacySnapshotPayload;

export function LegacyFunnel({ funnel, steps }: LegacyFunnelProps) {
  if (!funnel || !Array.isArray(steps) || steps.length === 0) {
    return (
      <div className="builder-v2-placeholder" style={{ padding: 24 }}>
        <p>No legacy funnel content available.</p>
      </div>
    );
  }

  return (
    <div className="builder-v2-legacy-wrapper">
      <FunnelRenderer funnel={funnel as any} steps={steps as any} />
    </div>
  );
}
