export type PromotionMetrics = {views:number;favorites:number;contacts:number};
export type PromotionSummary = {id:string;listingId:string;listingTitle:string;packageName:string;status:string;startAt:string|null;endAt:string|null};
export type PromotionPerformance = {
  promotionId:string;listingId:string;listingTitle:string;packageName:string;status:string;
  startAt:string;endAt:string;asOf:string;durationSeconds:number;
  before:{from:string;to:string;metrics:PromotionMetrics};
  during:{from:string;to:string;metrics:PromotionMetrics};
  change:Record<keyof PromotionMetrics,{difference:number;percent:number|null}>;
  coverage:{shortHistory:boolean;previousPromotion:boolean;favoritesPartial:boolean;favoritesTrackingSince:string|null};
};
export function promotionDate(value:string|null) {
  return value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}):'Chưa kích hoạt';
}
export function comparisonDuration(seconds:number) {
  if(seconds<60)return 'dưới 1 phút';
  const minutes=Math.floor(seconds/60);
  if(minutes<60)return `${minutes} phút`;
  return `${Math.floor(minutes/60)} giờ${minutes%60?` ${minutes%60} phút`:''}`;
}
