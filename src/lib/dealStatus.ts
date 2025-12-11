// src/lib/dealStatus.ts

export type DealLike = {
  status?: string | null;
  revenue?: number | null;
  closed_at?: string | null;
};

/**
 * Returns true when a deal has actually closed AND has some revenue logged.
 * Generic on purpose so it works with your current sales table shape.
 */
export function hasClosedWithRevenue(deal: DealLike): boolean {
  const revenue = Number(deal.revenue ?? 0);

  const status = (deal.status ?? '').toLowerCase();

  const isClosedStatus =
    status === 'closed_won' ||
    status === 'closed' ||
    status === 'won' ||
    status === 'complete';

  const hasClosedTimestamp = !!deal.closed_at;

  return isClosedStatus && revenue > 0 && hasClosedTimestamp;
}
