"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductImagePicker from "@/components/ProductImagePicker";
import LocationMap from "@/components/LocationMap";
import { Category, Listing, ListingStatus } from "@/lib/types";

const categories: Category[] = ["Học tập", "Công nghệ", "Nội thất", "Thời trang", "Khác"];
const conditions = ["Mới 100%", "Như mới", "Tốt", "Đã qua sử dụng"];

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listingId = resolvedParams.id;
  const router = useRouter();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [isExchange, setIsExchange] = useState(false);
  const [category, setCategory] = useState<Exclude<Category, "Tất cả">>("Học tập");
  const [condition, setCondition] = useState("Như mới");
  const [location, setLocation] = useState("");
  const [image, setImage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ListingStatus>("Active");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/listings/${listingId}`, { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        const item = data.product as Listing | undefined;
        if (!item) {
          setError("Không tìm thấy tin đăng này.");
          setLoading(false);
          return;
        }
        setListing(item);
        setTitle(item.title);
        setPrice(item.price);
        setIsExchange(item.price === 0);
        setCategory(item.category);
        setCondition(item.condition);
        setLocation(item.location);
        setImage(item.image);
        setDescription(item.description);
        setStatus(item.status);
        setLoading(false);
      })
      .catch(() => {
        setError("Không thể tải tin đăng.");
        setLoading(false);
      });
  }, [listingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Vui lòng điền đầy đủ tiêu đề và mô tả.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const finalPrice = isExchange ? 0 : Number(price);
      const form = new FormData();
      form.set("title", title.trim());
      form.set("price", String(finalPrice));
      form.set("category", category);
      form.set("condition", condition);
      form.set("location", location.trim());
      form.set("image", image.trim());
      form.set("description", description.trim());
      form.set("status", status);
      if (imageFile) form.set("imageFile", imageFile);
      const response = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể cập nhật tin.");

      router.push(`/my-listings?updated=1`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể cập nhật tin đăng lúc này.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="site-shell">
        <Navbar />
        <div style={{ textAlign: "center", padding: "100px", color: "#6e8073" }}>
          Đang tải dữ liệu tin đăng...
        </div>
        <Footer />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="site-shell">
        <Navbar />
        <div className="container empty-state" style={{ margin: "60px auto" }}>
          <span>⚠</span>
          <h3>Không tìm thấy tin đăng</h3>
          <p>Tin đăng này có thể đã bị xóa hoặc không còn tồn tại trên hệ thống.</p>
          <Link href="/my-listings">
            <button type="button">Quay lại quản lý tin</button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="site-shell">
      <Navbar />

      <main>
        {/* Banner tiêu đề */}
        <section className="page-header-banner">
          <div className="container">
            <div className="eyebrow">
              <span className="eyebrow-line" /> CHỈNH SỬA TIN ĐĂNG
            </div>
            <h1>Chỉnh sửa: {listing.title}</h1>
            <p>Cập nhật giá cả, tình trạng hoặc thông tin liên lạc cho món đồ của bạn.</p>
          </div>
        </section>

        {/* Form chỉnh sửa */}
        <section className="container" style={{ padding: "40px 0 80px", maxWidth: "800px" }}>
          <div className="account-content-card">
            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{ padding: "12px 16px", background: "#fdf2f0", color: "#b83829", borderRadius: "8px", marginBottom: "20px", fontSize: "13px" }}>
                  ⚠ {error}
                </div>
              )}

              <div className="form-group-grid">
                <div className="form-field full">
                  <label>Tên món đồ / Tiêu đề tin đăng *</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Trạng thái hiển thị</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as ListingStatus)}
                  >
                    <option value="Active">Đang hiển thị (Mở bán)</option>
                    <option value="Sold">Đã bán / Đã sang tay</option>
                    <option value="Hidden">Tạm ẩn khỏi chợ</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Hình thức tin</label>
                  <select
                    value={isExchange ? "exchange" : "sell"}
                    onChange={e => {
                      const val = e.target.value === "exchange";
                      setIsExchange(val);
                      if (val) setPrice(0);
                    }}
                  >
                    <option value="sell">Bán lại (Có giá tiền)</option>
                    <option value="exchange">Trao đổi đồ cũ (0đ)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Giá bán (VNĐ) {!isExchange && "*"}</label>
                  <input
                    type="number"
                    value={isExchange ? 0 : price}
                    onChange={e => setPrice(Number(e.target.value))}
                    disabled={isExchange}
                    min={0}
                    required={!isExchange}
                  />
                </div>

                <div className="form-field">
                  <label>Danh mục *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as Exclude<Category, "Tất cả">)}
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Tình trạng *</label>
                  <select value={condition} onChange={e => setCondition(e.target.value)}>
                    {conditions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field full">
                  <label>Địa điểm hẹn gặp *</label>
                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field full"><LocationMap location={location} school={listing.school} preview/></div>
                <ProductImagePicker file={imageFile} currentImage={image} onChange={setImageFile} onError={setError} />

                <div className="form-field full">
                  <label>Mô tả chi tiết *</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                <Link href="/my-listings" className="action-btn-sm" style={{ padding: "12px 20px" }}>
                  Hủy thay đổi
                </Link>
                <button
                  type="submit"
                  className="post-button"
                  style={{ padding: "12px 24px" }}
                  disabled={submitting}
                >
                  {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
