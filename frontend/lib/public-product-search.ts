import { transaction } from "./db";
import { listingQuery, type parseListingQuery } from "./listing-query";
import { productSelect, mapProduct } from "./products";

/** The catalogue and assistant share visibility, filters, ordering and pagination. */
export async function searchPublicProducts(filters: ReturnType<typeof parseListingQuery>) {
  const { where, values, orderBy } = listingQuery(filters);
  return transaction(async client => {
    await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const count = await client.query("SELECT COUNT(*)::int AS total FROM products p JOIN categories cat ON cat.id=p.category_id LEFT JOIN users u ON u.id=p.seller_id" + where, values);
    const total = count.rows[0].total as number;
    const totalPages = Math.ceil(total / filters.pageSize);
    const page = Math.min(filters.page, Math.max(totalPages, 1));
    const rows = await client.query(productSelect + where + ` ORDER BY ${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, filters.pageSize, (page - 1) * filters.pageSize]);
    return { products: rows.rows.map(mapProduct), pagination: { page, pageSize: filters.pageSize, total, totalPages, hasPrevious: page > 1, hasNext: page < totalPages } };
  });
}
