export type CatalogFilters = {
  search: string;
  category: string;
  sort: string;
  school: string;
};

// Use the same filters for refresh and pagination, including the selected school.
export function catalogPath(filters: CatalogFilters, page = 1) {
  return "/api/products?" + new URLSearchParams({
    q: filters.search,
    category: filters.category,
    sort: filters.sort,
    school: filters.school,
    page: String(page),
  });
}
