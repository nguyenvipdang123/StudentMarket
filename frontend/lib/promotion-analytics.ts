import { query } from './db';
import { ApiError,isUUID } from './api-error';
import type { AuthenticatedUser } from './auth-pg';
import type { PromotionPerformance,PromotionMetrics } from './promotion-analytics-types';

export async function promotionPerformance(id:string,user:AuthenticatedUser):Promise<PromotionPerformance> {
  if(!isUUID(id))throw new ApiError('Không tìm thấy gói đẩy tin.',404);
  if(!['student','admin'].includes(user.role))throw new ApiError('Bạn không có quyền xem thống kê này.',403);
  // Use database time and half-open windows, keeping sub-millisecond timestamps and activation boundaries exact.
  const [row]=await query(`WITH purchased AS (
    SELECT lp.*,p.title,p.created_at AS listing_created_at,p.seller_id,
      COALESCE(lp.package_name_snapshot,pp.name) AS package_name,NOW() AS observed_at,
      GREATEST(lp.start_at,LEAST(NOW(),lp.end_at,CASE WHEN lp.status='CANCELLED' THEN lp.updated_at ELSE lp.end_at END)) AS measured_to
    FROM listing_promotions lp JOIN products p ON p.id=lp.listing_id JOIN promotion_packages pp ON pp.id=lp.package_id
    WHERE lp.id=$1 AND lp.payment_status='PAID' AND lp.start_at IS NOT NULL AND lp.end_at>lp.start_at
      AND (lp.user_id=$2 OR $3='admin')
  ), periods AS (
    SELECT purchased.*,start_at-(measured_to-start_at) AS before_from FROM purchased
  ) SELECT t.id,t.listing_id,t.title,t.package_name,t.start_at,t.end_at,t.observed_at,t.measured_to,t.before_from,
    CASE WHEN t.status='ACTIVE' AND t.end_at<=t.observed_at THEN 'EXPIRED' ELSE t.status END AS effective_status,
    EXTRACT(EPOCH FROM(t.measured_to-t.start_at))::float8 AS duration_seconds,
    t.listing_created_at>t.before_from AS short_history,
    EXISTS(SELECT 1 FROM listing_promotions other WHERE other.listing_id=t.listing_id AND other.id<>t.id
      AND other.payment_status='PAID' AND other.start_at<t.start_at
      AND LEAST(other.end_at,CASE WHEN other.status='CANCELLED' THEN other.updated_at ELSE other.end_at END)>t.before_from
    ) AS previous_promotion,
    (SELECT started_at FROM analytics_tracking WHERE event_type='FAVORITE') AS favorites_tracking_since,
    COALESCE((SELECT started_at>t.before_from FROM analytics_tracking WHERE event_type='FAVORITE'),TRUE) AS favorites_partial,
    (SELECT json_object_agg(w.period,json_build_object('views',
        (SELECT COUNT(*)::int FROM listing_analytics a WHERE a.listing_id=t.listing_id AND a.event_type='VIEW'
          AND a.created_at>=w.from_at AND a.created_at<w.to_at AND (a.user_id IS NULL OR a.user_id<>t.seller_id)),
      'favorites',(SELECT COUNT(DISTINCT a.user_id)::int FROM listing_analytics a WHERE a.listing_id=t.listing_id AND a.event_type='FAVORITE'
          AND a.created_at>=w.from_at AND a.created_at<w.to_at AND a.user_id<>t.seller_id),
      'contacts',(SELECT COUNT(DISTINCT c.buyer_id)::int FROM conversations c JOIN messages m ON m.conversation_id=c.id
          WHERE c.product_id=t.listing_id AND c.seller_id=t.user_id AND m.sender_id=c.buyer_id AND c.buyer_id<>t.seller_id
            AND m.sent_at>=w.from_at AND m.sent_at<w.to_at)
    )) FROM (VALUES('before',t.before_from,t.start_at),('during',t.start_at,t.measured_to)) w(period,from_at,to_at)) AS metrics
    FROM periods t`,[id,user.pgUserId,user.role]);
  if(!row)throw new ApiError('Không tìm thấy gói đã thanh toán của bạn.',404);
  const before=row.metrics.before as PromotionMetrics,during=row.metrics.during as PromotionMetrics;
  const change={} as PromotionPerformance['change'];
  for(const key of ['views','favorites','contacts'] as const) {
    const comparable=row.duration_seconds>0&&!row.short_history&&!row.previous_promotion&&(key!=='favorites'||!row.favorites_partial);
    change[key]={difference:during[key]-before[key],percent:comparable&&before[key]>0?Math.round((during[key]-before[key])/before[key]*1000)/10:null};
  }
  return {
    promotionId:row.id,listingId:row.listing_id,listingTitle:row.title,packageName:row.package_name,status:row.effective_status,
    startAt:row.start_at.toISOString(),endAt:row.end_at.toISOString(),asOf:row.observed_at.toISOString(),durationSeconds:row.duration_seconds,
    before:{from:row.before_from.toISOString(),to:row.start_at.toISOString(),metrics:before},
    during:{from:row.start_at.toISOString(),to:row.measured_to.toISOString(),metrics:during},change,
    coverage:{shortHistory:row.short_history,previousPromotion:row.previous_promotion,favoritesPartial:row.favorites_partial,
      favoritesTrackingSince:row.favorites_tracking_since?.toISOString()||null},
  };
}
