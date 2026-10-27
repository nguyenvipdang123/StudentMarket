import type { QueryResultRow } from 'pg';

/** Preserve the gift marker used by existing listings; no database migration needed. */
export function mapFavoriteProduct(row: QueryResultRow) {
  const price = Number(row.price);
  const description = typeof row.description === 'string' ? row.description : '';
  return {
    id: row.id,
    productId: row.product_id,
    title: row.title,
    price,
    description,
    freeGift: price === 0 && description.startsWith('Tặng miễn phí.'),
    status: row.status,
    condition: row.condition,
    location: row.location,
    seller: row.seller_name,
    school: row.seller_school,
    image: row.image || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300',
    savedAt: row.created_at,
    priceAlertEnabled: row.price_alert_enabled,
  };
}
