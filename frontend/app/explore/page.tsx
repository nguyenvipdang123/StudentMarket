"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "@/components/TransitionLink";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import UniversityPicker from "@/components/UniversityPicker";
import ProductPagination from "@/components/ProductPagination";
import MarketplaceCard from "@/components/MarketplaceCard";
import { figmaCardMotion } from "@/lib/figma-card-motion";
import FigmaHeroArt from "@/components/FigmaHeroArt";
import HomeProductSections from "@/components/HomeProductSections";
import Icon from "@/components/FigmaIcon";
import { SaveNeedButton } from "@/components/SavedSearches";
import { Category, Listing, Viewer } from "@/lib/types";

import { ListingKindFilter, ListingSort } from "@/lib/listing-search";
import { useProductSearch } from "@/lib/use-product-search";
import { findUniversity, SOUTHERN_UNIVERSITIES, UNIVERSITY_STORAGE_KEY } from "@/lib/universities";

const categories: { name: Category; icon: string; hint: string }[] = [
  { name: "Tất cả", icon: "grid", hint: "Khám phá mọi món đồ" },
  { name: "Học tập", icon: "book", hint: "Giáo trình, sách, dụng cụ học tập" },
  { name: "Công nghệ", icon: "laptop", hint: "Laptop, điện thoại, phụ kiện" },
  { name: "Nội thất", icon: "home", hint: "Bàn học, ghế, đồ dùng phòng trọ" },
  { name: "Thời trang", icon: "shirt", hint: "Quần áo, giày dép, balo" },
  { name: "Khác", icon: "sparkles", hint: "Những món đồ hữu ích khác" },
];

function CategoryIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    heart: <path d="M20.8 8.7c0 4.3-8.8 10-8.8 10s-8.8-5.7-8.8-10a4.8 4.8 0 0 1 8.8-2.6 4.8 4.8 0 0 1 8.8 2.6Z" />,
    arrow: <><path d="M4 12h16M13 5l7 7-7 7" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.3" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    book: <><path d="M12 6.5C9.3 4.7 6.8 4.2 3 4.5v14c3.8-.3 6.3.2 9 2 2.7-1.8 5.2-2.3 9-2v-14c-3.8-.3-6.3.2-9 2Z" /><path d="M12 6.5v14" /></>,
    laptop: <><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20M8 19h8" /></>,
    home: <><path d="m3 10 9-7 9 7v10H3V10Z" /><path d="M9 20v-7h6v7" /></>,
    shirt: <path d="m8 4 4 2 4-2 5 3-2 5-3-1v9H8v-9l-3 1-2-5 5-3Z" />,
    sparkles: <><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2ZM20 17l.6 1.4L22 19l-1.4.6L20 21l-.6-1.4L18 19l1.4-.6L20 17Z" /></>,
    shield: <><path d="M12 2 4 5v6c0 5.4 3.5 8.6 8 11 4.5-2.4 8-5.6 8-11V5l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    chat: <path d="M20 11.5a8 8 0 0 1-8 8 8.6 8.6 0 0 1-3.5-.8L4 20l1.3-4.5a8 8 0 1 1 14.7-4Z" />,
    close: <path d="M5 5 19 19M19 5 5 19" />,
    filter: <><path d="M4 7h16M7 12h10M10 17h4" /></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.grid}
    </svg>
  );
}

function SearchQuerySync({ onChange }: { onChange: (value: string) => void }) {
  const params = useSearchParams();
  const queryString = params.toString();
  useEffect(() => { onChange(queryString); }, [queryString, onChange]);
  return null;
}

export default function ExplorePage() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("Tất cả");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<ListingSort>("featured");
  const [kind, setKind] = useState<ListingKindFilter>("all");
  const [condition, setCondition] = useState("");
  const [school, setSchool] = useState("");
  const [draftSchool, setDraftSchool] = useState("");
  const [schoolPickerOpen, setSchoolPickerOpen] = useState(false);
  const [hasSchoolPreference, setHasSchoolPreference] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [toast, setToast] = useState("");
  const [pageSelection, setPageSelection] = useState({ filters: "", page: 1 });
  const [locationQuery, setLocationQuery] = useState<string | null>(null);
  const filterParameters = new URLSearchParams({ category, q: search, sort, kind, condition, school, minPrice, maxPrice }).toString();
  const page = pageSelection.filters === filterParameters ? pageSelection.page : 1;
  const invalidPriceRange = minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice);
  const { products: visibleListings, pagination, loading: isLoading, error: loadError, retry: retryListings } = useProductSearch(invalidPriceRange ? null : filterParameters + "&page=" + page);
  useEffect(() => {
    // Reset even when returning to a filter combination that was used earlier.
    const timer = setTimeout(() => setPageSelection({ filters: filterParameters, page: 1 }), 0);
    return () => clearTimeout(timer);
  }, [filterParameters]);

  const refreshData = async () => {
    try {
      const authRes = await fetch("/api/auth/me", { cache: "no-store" });
      const authData = authRes.ok ? await authRes.json() : { user: null };
      const currentUser = authData.user || null;
      setViewer(currentUser);

      if (currentUser) {
        const favRes = await fetch("/api/favorites", { cache: "no-store" });
        if (favRes.ok) {
          const favData = await favRes.json();
          const ids = (favData.favorites || []).map((f: { productId: string }) => String(f.productId));
          setSavedIds(ids);
        } else {
          setSavedIds([]);
        }
      } else {
        setSavedIds([]);
      }
    } catch (e) {
      console.error("Failed to load explore data:", e);
      setSavedIds([]);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => refreshData());

    const handleSavedChanged = () => {
      fetch("/api/favorites", { cache: "no-store" })
        .then(res => res.json())
        .then(data => {
          if (data.favorites) {
            setSavedIds(data.favorites.map((f: { productId: string }) => String(f.productId)));
          }
        })
        .catch(() => {});
    };

    const handleAuthChanged=()=>void refreshData();
    window.addEventListener("sangtay_auth_changed",handleAuthChanged);
    window.addEventListener("sangtay_saved_changed", handleSavedChanged);
    return () => {window.removeEventListener("sangtay_auth_changed",handleAuthChanged);window.removeEventListener("sangtay_saved_changed", handleSavedChanged);};
  }, []);

  useEffect(() => {
    if (locationQuery === null) return;
    const timer = window.setTimeout(() => {
      try {
        const params = new URLSearchParams(locationQuery);
        const initialSearch = params.get("q");
        if (initialSearch !== null && initialSearch.length <= 200) { setQuery(initialSearch); setSearch(initialSearch); }
        const initialCategory = params.get("category");
        if (categories.some(item => item.name === initialCategory)) setCategory(initialCategory as Category);
        const initialSort = params.get("sort");
        if (["featured", "newest", "price-asc", "price-desc"].includes(initialSort || "")) setSort(initialSort as ListingSort);
        const initialKind = params.get("kind");
        if (["all", "sell", "exchange"].includes(initialKind || "")) setKind(initialKind as ListingKindFilter);
        const initialCondition = params.get("condition");
        if (["", "Mới 100%", "Như mới", "Tốt", "Đã qua sử dụng"].includes(initialCondition || "")) setCondition(initialCondition || "");
        for (const [key, setter] of [["minPrice", setMinPrice], ["maxPrice", setMaxPrice]] as const) {
          const value = params.get(key); if (value !== null && /^(?:\d+(?:\.\d{1,2})?)?$/.test(value) && Number(value) <= 9999999999) setter(value);
        }
        if (params.has("school") && (params.get("school")?.length || 0) <= 200) {
          const selectedSchool = params.get("school") || "";
          setSchool(selectedSchool); setHasSchoolPreference(true);
          window.localStorage.setItem(UNIVERSITY_STORAGE_KEY, selectedSchool); return;
        }
        window.localStorage.removeItem("sangtay_search_province_v1");
        const saved = window.localStorage.getItem(UNIVERSITY_STORAGE_KEY);
        const university = saved ? findUniversity(saved) : undefined;
        if (saved === "" || university) {
          setSchool(university?.name || "");
          setHasSchoolPreference(true);
        } else {
          if(!new URLSearchParams(window.location.search).get("auth"))setSchoolPickerOpen(true);
        }
      } catch {
        setSchoolPickerOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [locationQuery]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) setSuggestionsOpen(false);
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [suggestionsOpen]);
  const hasFilters = Boolean(search || category !== "Tất cả" || kind !== "all" || condition || school || minPrice || maxPrice);
  const filterCount = [kind !== "all", Boolean(condition), Boolean(school), Boolean(minPrice || maxPrice)].filter(Boolean).length;

  const saveSchool = (value: string) => {
    setSchool(value);
    setHasSchoolPreference(true);
    setSchoolPickerOpen(false);
    try { window.localStorage.setItem(UNIVERSITY_STORAGE_KEY, value); } catch { /* Browsing still works without storage. */ }
  };

  const openSchoolPicker = () => {
    setDraftSchool(school);
    setSchoolPickerOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setQuery("");
    setCategory("Tất cả");
    setKind("all");
    setCondition("");
    saveSchool("");
    setMinPrice("");
    setMaxPrice("");
    setSort("featured");
  };

  const handleToggleSave = async (id: string | number) => {
    if (!viewer) {
      setToast("Vui lòng đăng nhập để lưu tin yêu thích.");
      return;
    }

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: String(id) }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.isSaved) {
          setSavedIds(prev => [...prev, String(id)]);
          setToast("Đã lưu tin vào mục Yêu thích ♡");
        } else {
          setSavedIds(prev => prev.filter(x => x !== String(id)));
          setToast("Đã bỏ lưu tin");
        }
        window.dispatchEvent(new Event("sangtay_saved_changed"));
      }
    } catch {
      setToast("Có lỗi xảy ra khi lưu tin.");
    }
  };

  const handleContactSeller = (item: Listing) => { router.push(viewer?.pgUserId === item.sellerId ? "/my-listings" : "/messages?listingId=" + item.id); };

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query.trim()) {
      searchInputRef.current?.focus();
      setSuggestionsOpen(true);
      return;
    }
    setSearch(query.trim());
    setSuggestionsOpen(false);
    document.getElementById("marketplace-grid")?.scrollIntoView({ behavior: "smooth" });
  };

  const closeSuggestions = () => {
    searchInputRef.current?.focus();
    setSuggestionsOpen(false);
  };

  const selectSuggestedCategory = (name: Category) => {
    setCategory(name);
    setSearch("");
    setQuery("");
    setSuggestionsOpen(false);
    document.getElementById("marketplace-grid")?.scrollIntoView({ behavior: "smooth" });
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(".category-pill.selected")?.focus({ preventScroll: true });
    });
  };

  return (
    <div className="site-shell marketplace-shell figma-marketplace">
      <Suspense fallback={null}><SearchQuerySync onChange={setLocationQuery}/></Suspense>
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="hero" aria-label="Tìm đồ dùng sinh viên">
          <div className="hero-inner container">
            <div className="hero-copy">
              <div className="eyebrow">
                <Icon name="graduation" size={18} /> Dành cho sinh viên
              </div>
              <h1>
                Đồ cũ còn tốt.<br />
                <span className="figma-hero-second">Chủ mới thật vui.</span>
              </h1>
              <p>
                Mua bán, trao đổi những món đồ bạn cần với sinh viên quanh mình. Tiết kiệm hơn, kết nối gần hơn.
              </p>

              <div
                className="hero-search-wrap"
                ref={searchWrapRef}
                onBlur={event => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSuggestionsOpen(false);
                }}
                onKeyDown={event => {
                  if (event.key === "Escape" && suggestionsOpen) {
                    event.preventDefault();
                    closeSuggestions();
                  }
                }}
              >
                <form className="hero-search" onSubmit={handleSearchSubmit}>
                  <CategoryIcon name="search" />
                  <input
                    ref={searchInputRef}
                    value={query}
                    onFocus={() => setSuggestionsOpen(true)}
                    onClick={() => setSuggestionsOpen(true)}
                    onChange={e => { setQuery(e.target.value); setSuggestionsOpen(true); }}
                    onKeyDown={event => {
                      if (event.key === "ArrowDown" && suggestionsOpen) {
                        event.preventDefault();
                        searchWrapRef.current?.querySelector<HTMLButtonElement>(".search-suggestion-category")?.focus();
                      }
                    }}
                    placeholder="Tìm giáo trình, laptop, bàn học..."
                    aria-label="Tìm kiếm món đồ"
                    aria-controls={suggestionsOpen ? "search-suggestions" : undefined}
                    autoComplete="off"
                  />
                  <button type="submit" aria-label="Tìm kiếm" aria-expanded={suggestionsOpen} aria-controls={suggestionsOpen ? "search-suggestions" : undefined}>
                    Tìm kiếm <CategoryIcon name="arrow" />
                  </button>
                </form>

                {suggestionsOpen && (
                  <section className="search-suggestions" id="search-suggestions" aria-labelledby="search-suggestions-title">
                    <div className="search-suggestions-heading">
                      <div>
                        <h3 id="search-suggestions-title">Gợi ý cho bạn</h3>
                        <p>Chọn danh mục để khám phá nhanh</p>
                      </div>
                      <button className="search-suggestions-close" type="button" onClick={closeSuggestions} aria-label="Đóng gợi ý tìm kiếm">
                        <CategoryIcon name="close" />
                      </button>
                    </div>
                    <div className="search-suggestion-categories" role="group" aria-label="Danh mục gợi ý">
                      {categories.map(item => (
                        <button
                          key={item.name}
                          type="button"
                          className="search-suggestion-category"
                          aria-label={`Xem danh mục ${item.name}`}
                          aria-pressed={category === item.name}
                          onClick={() => selectSuggestedCategory(item.name)}
                        >
                          <span className="search-suggestion-icon"><CategoryIcon name={item.icon} /></span>
                          <span><strong>{item.name}</strong><small>{item.hint}</small></span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="figma-hero-actions"><button className="region-current" type="button" onClick={openSchoolPicker}>
                <CategoryIcon name="book" /> <span>{school || "Tất cả trường đại học"}</span><span className="region-change"><CategoryIcon name="chevron" /></span>
              </button>

              <Link className="figma-button primary" href="/create-listing">Đăng tin miễn phí <Icon name="plus" size={18}/></Link></div>
              <div className="hero-trending">
                <span>Gợi ý:</span>
                {["Giáo trình", "Laptop", "Bàn học", "Máy ảnh", "Đèn bàn"].map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setQuery(item);
                      setSearch(item);
                      document.getElementById("marketplace-grid")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <FigmaHeroArt />
          </div>

          <div className="hero-bottom container">
            <div className="hero-stat">
              <strong>0đ</strong>
              <span>Phí đăng tin</span>
            </div>
            <div className="stat-divider" />
            <div className="hero-stat">
              <strong>Gần bạn</strong>
              <span>Dễ hẹn xem đồ</span>
            </div>
            <div className="stat-divider" />
            <div className="hero-stat">
              <strong>Tiết kiệm</strong>
              <span>Vui cho ví tiền</span>
            </div>

          </div>
        </section>

        {/* Marketplace Explorer Grid */}
        <section className="market-section container" id="marketplace-grid" aria-labelledby="marketplace-title">
          <div className="section-heading">
            <div>
              <div className="section-kicker">KHÁM PHÁ NGAY</div>
              <h2 id="marketplace-title">
                {hasFilters ? "Món đồ dành cho bạn" : "Món đồ nổi bật"}
              </h2>
              <p>Đồ học tập, đồ phòng trọ và những món hay cho học kỳ mới.</p>
            </div>
            <span className="results-count" aria-live="polite">{isLoading ? "Đang tải..." : loadError ? "Chưa tải được" : `${pagination.total} món đồ`}</span>
          </div>

          <div className="market-region">
            <CategoryIcon name="book" /><span>Đang xem tin của <strong>{school || "Tất cả trường"}</strong></span>
            <button type="button" onClick={openSchoolPicker}>Đổi trường</button>
          </div>

          <SaveNeedButton viewer={viewer} filters={{q:search,category,kind,condition,school,minPrice,maxPrice}} invalid={invalidPriceRange}/>

          <div className="market-tools">
            <div className="category-list" role="group" aria-label="Danh mục sản phẩm">
              {categories.map(item => (
                <button
                  key={item.name}
                  className={`category-pill ${category === item.name ? "selected" : ""}`}
                  type="button"
                  aria-pressed={category === item.name}
                  onClick={() => setCategory(item.name)}
                >
                  <CategoryIcon name={item.icon} />
                  {item.name}
                </button>
              ))}
            </div>

            <div className="market-tool-actions">
              <button className={`filter-toggle ${filtersOpen || filterCount ? "is-active" : ""}`} type="button" onClick={() => setFiltersOpen(open => !open)} aria-expanded={filtersOpen} aria-controls="marketplace-filters">
                <CategoryIcon name="filter" /> Bộ lọc {filterCount > 0 && <span>{filterCount}</span>}
              </button>
              <div className="sort-wrap">
              <CategoryIcon name="filter" />
              <select
                aria-label="Sắp xếp sản phẩm"
                value={sort}
                onChange={e => setSort(e.target.value as ListingSort)}
              >
                <option value="featured">Nổi bật</option>
                <option value="newest">Mới nhất</option>
                <option value="price-asc">Giá thấp đến cao</option>
                <option value="price-desc">Giá cao đến thấp</option>
              </select>
              <CategoryIcon name="chevron" />
              </div>
            </div>
          </div>

          <div className="listing-filters" id="marketplace-filters" hidden={!filtersOpen} aria-label="Lọc tin đăng">
            <label>
              Hình thức
              <select value={kind} onChange={e => setKind(e.target.value as ListingKindFilter)}>
                <option value="all">Tất cả</option>
                <option value="sell">Mua bán</option>
                <option value="exchange">Trao đổi miễn phí</option>
              </select>
            </label>
            <label>
              Tình trạng
              <select value={condition} onChange={e => setCondition(e.target.value)}>
                <option value="">Mọi tình trạng</option>
                <option value="Mới 100%">Mới 100%</option>
                <option value="Như mới">Như mới</option>
                <option value="Tốt">Tốt</option>
                <option value="Đã qua sử dụng">Đã qua sử dụng</option>
              </select>
            </label>
            <label>
              Trường
              <select value={school} onChange={e => saveSchool(e.target.value)}>
                <option value="">Tất cả trường</option>
                {SOUTHERN_UNIVERSITIES.map(university => <option key={university.name} value={university.name}>{university.name}</option>)}
              </select>
            </label>
            <label>
              Giá từ (đ)
              <input type="number" min="0" step="1000" inputMode="numeric" placeholder="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
            </label>
            <label>
              Đến (đ)
              <input type="number" min="0" step="1000" inputMode="numeric" placeholder="Không giới hạn" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} aria-invalid={invalidPriceRange} />
            </label>
            {hasFilters && <button className="clear-listing-filters" type="button" onClick={clearFilters}>Xóa bộ lọc</button>}
          </div>
          {(kind !== "all" || condition || minPrice || maxPrice) && (
            <div className="active-filter-chips" aria-label="Bộ lọc đang áp dụng">
              <span>Đang lọc:</span>
              {kind !== "all" && <button type="button" onClick={() => setKind("all")} aria-label="Bỏ lọc hình thức">{kind === "sell" ? "Mua bán" : "Trao đổi miễn phí"}<CategoryIcon name="close" /></button>}
              {condition && <button type="button" onClick={() => setCondition("")} aria-label="Bỏ lọc tình trạng">{condition}<CategoryIcon name="close" /></button>}
              {(minPrice || maxPrice) && <button type="button" onClick={() => { setMinPrice(""); setMaxPrice(""); }} aria-label="Bỏ lọc khoảng giá">{Number(minPrice || 0).toLocaleString("vi-VN")}đ – {maxPrice ? `${Number(maxPrice).toLocaleString("vi-VN")}đ` : "Không giới hạn"}<CategoryIcon name="close" /></button>}
            </div>
          )}
          {invalidPriceRange && <p className="filter-error" role="alert">Giá tối đa cần lớn hơn hoặc bằng giá tối thiểu.</p>}

          {search && (
            <div className="search-summary">
              Kết quả cho <strong>“{search}”</strong>
              <button
                onClick={() => {
                  setSearch("");
                  setQuery("");
                }}
                aria-label="Xóa tìm kiếm"
              >
                <CategoryIcon name="close" />
              </button>
            </div>
          )}

          {isLoading ? (
            <div role="status" aria-label="Đang tải tin đăng" aria-busy="true">
              <div className="product-grid" aria-hidden="true">
                {Array.from({ length: 8 }, (_, index) => <div className="listing-skeleton" key={index}><div className="skeleton-image" /><div className="skeleton-body"><i /><i /><i /></div></div>)}
              </div>
            </div>
          ) : loadError ? (
            <div className="empty-state" role="alert">
              <span>⚠️</span>
              <h3>Chưa tải được tin đăng</h3>
              <p>{loadError}</p>
              <button type="button" onClick={retryListings}>Thử lại</button>
            </div>
          ) : visibleListings.length > 0 ? (
            <>
              <div className="product-grid" id="listing-results" tabIndex={-1} aria-label={`Sản phẩm trang ${pagination.page}`}>
                {visibleListings.map((item,index) => <MarketplaceCard motionId={figmaCardMotion.featured[index]} key={item.id} item={item} saved={savedIds.includes(String(item.id))} onSave={item => void handleToggleSave(item.id)} onContact={handleContactSeller} />)}
              </div>
              <ProductPagination pagination={pagination} onPage={next => {
                setPageSelection({ filters: filterParameters, page: next });
                document.getElementById("marketplace-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }} />
            </>
          ) : (
            <div className="empty-state">
              <span>🔎</span>
              <h3>Chưa tìm thấy món đồ phù hợp</h3>
              <p>{school ? `Chưa có món đồ phù hợp từ sinh viên ${school}. Hãy thử trường khác hoặc xem tất cả trường.` : hasFilters ? "Thử đổi từ khóa hoặc bỏ bớt bộ lọc nhé!" : "Hiện chưa có tin đăng được duyệt. Ghé lại sau nhé!"}</p>
              {school && <button type="button" onClick={openSchoolPicker}>Đổi trường</button>}
              {hasFilters && <button type="button" onClick={clearFilters}>Xem tất cả món đồ</button>}
            </div>
          )}

        </section>

        {!(search || category !== "Tất cả" || kind !== "all" || condition || minPrice || maxPrice) && <HomeProductSections school={school} savedIds={savedIds} onSave={item => void handleToggleSave(item.id)} onContact={handleContactSeller} onSchool={openSchoolPicker} onBrowse={type => { clearFilters(); if(type === "study") setCategory("Học tập"); if(type === "dorm") setCategory("Nội thất"); if(type === "budget") setMaxPrice("199999"); if(type === "exchange") setKind("exchange"); if(type === "new") setSort("newest"); document.getElementById("marketplace-grid")?.scrollIntoView({behavior:"smooth"}); }} />}
      </main>

      {schoolPickerOpen && <UniversityPicker
        open={schoolPickerOpen}
        value={draftSchool}
        onChange={setDraftSchool}
        onApply={() => saveSchool(draftSchool)}
        onDismiss={() => {
          if (hasSchoolPreference) setSchoolPickerOpen(false);
          else saveSchool("");
        }}
      />}

      <Footer />
    </div>
  );
}
