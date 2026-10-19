import type { QueryResultRow } from "pg";
export const productSelect = `SELECT p.id, cat.name AS category, p.title, p.price, p.status, p.moderation_status, p.condition, p.location, p.description,
            p.view_count, p.created_at, p.seller_id,
            (SELECT r.expires_at FROM listing_reservations r WHERE r.listing_id=p.id AND r.status='CONFIRMED'
              AND r.expires_at>NOW() AND p.status='Active' AND p.moderation_status='APPROVED' AND r.seller_id=p.seller_id LIMIT 1) AS reserved_until,
            u.full_name AS seller_name, u.university AS seller_school,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) AS image,
            (SELECT json_agg(pi.image_url ORDER BY pi.is_primary DESC, pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) AS images,
            (SELECT COUNT(*) FROM favorites f WHERE f.product_id = p.id) AS likes,
            (SELECT COUNT(DISTINCT c.id) FROM conversations c WHERE c.product_id = p.id) AS chats,
            lp.id AS promotion_id,
            lp.status AS promotion_status,
            COALESCE(lp.package_name_snapshot,pp.name) AS promotion_name,
            COALESCE(lp.priority_snapshot,pp.priority) AS promotion_priority,
            lp.start_at AS promotion_start_at,
            lp.end_at AS promotion_end_at
     FROM products p
     JOIN categories cat ON cat.id = p.category_id
     LEFT JOIN users u ON u.id = p.seller_id
     LEFT JOIN LATERAL (
       SELECT active.* FROM listing_promotions active
       LEFT JOIN promotion_packages package ON package.id=active.package_id
       WHERE active.listing_id=p.id AND active.status='ACTIVE' AND NOW() BETWEEN active.start_at AND active.end_at
       ORDER BY COALESCE(active.priority_snapshot,package.priority,0) DESC, active.end_at DESC, active.id DESC LIMIT 1
     ) lp ON TRUE
     LEFT JOIN promotion_packages pp ON pp.id = lp.package_id
`;
export function mapProduct(r: QueryResultRow) { return ({
      id: r.id,
      title: r.title,
      category: r.category,
      price: Number(r.price),
      status: r.status,
      moderationStatus: r.moderation_status,
      condition: r.condition,
      location: r.location,
      description: r.description,
      views: r.view_count,
      likes: Number(r.likes),
      chats: Number(r.chats),
      seller: r.seller_name,
      sellerId: r.seller_id,
      reservedUntil: r.reserved_until?.toISOString() || null,
      school: r.seller_school,
      image: r.image || "/sample/khac.svg",
      images: r.images || [],
      promotion: r.promotion_status === "ACTIVE" ? {
        id: r.promotion_id,
        name: r.promotion_name,
        priority: Number(r.promotion_priority) || 0,
        badge: Number(r.promotion_priority) >= 3 ? "Pro" : (Number(r.promotion_priority) >= 2 ? "Đang được đẩy" : "Nổi bật"),
        startAt: r.promotion_start_at?.toISOString() || null,
        endAt: r.promotion_end_at?.toISOString() || null,
      } : null,
      createdAt: r.created_at?.toISOString() || "",
    }); }
