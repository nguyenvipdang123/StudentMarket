"use client";
import Link from "@/components/TransitionLink";
import { figmaCardMotion } from "@/lib/figma-card-motion";
import { useProductSearch } from "@/lib/use-product-search";
import type { Listing } from "@/lib/types";
import MarketplaceCard from "./MarketplaceCard";
import Icon from "./FigmaIcon";
import { CardSkeletons, EmptyState } from "./FigmaStates";
import LoadingIndicator from "./LoadingIndicator";

const sections = [
  { id: "25:29993", title: "Gần trường của bạn", kicker: "CÙNG CỘNG ĐỒNG", description: "Dễ hẹn gặp, dễ xem đồ — tìm những món hay quanh trường.", type: "near", action: "Khám phá quanh trường", size: 4 },
  { id: "25:30180", title: "Đồ học tập cho học kỳ mới", kicker: "SẴN SÀNG KỲ MỚI", description: "Giáo trình và phụ kiện học tập, thêm một học kỳ thật tốt.", type: "study", action: "Xem đồ học tập", size: 6 },
  { id: "25:30444", title: "Góc phòng trọ", kicker: "MỘT GÓC THẬT CHILL", description: "Thêm một chút tiện nghi, thêm yêu căn phòng của bạn.", type: "dorm", action: "Xem đồ phòng trọ", size: 6 },
  { id: "25:30708", title: "Dưới 200.000đ", kicker: "VỪA TÚI TIỀN", description: "Món nhỏ, giá dễ thương. Có khi thứ bạn cần chỉ dưới 200k.", type: "budget", action: "Xem món giá tốt", size: 4 },
  { id: "25:30887", title: "Trao đổi & Tặng miễn phí", kicker: "CŨ VỚI BẠN, MỚI VỚI AI ĐÓ", description: "Đổi món đồ cũ, thêm một kết nối mới cùng sinh viên quanh bạn.", type: "exchange", action: "Xem tin trao đổi", size: 4 },
  { id: "25:31073", title: "Mới đăng", kicker: "MÓN MỚI MỖI NGÀY", description: "Những món đồ vừa lên chợ, tìm chủ mới hôm nay.", type: "new", action: "Xem tất cả tin mới", size: 4 },
];
type Props = { school: string; savedIds: string[]; onSave: (item: Listing) => void; onContact: (item: Listing) => void; onSchool: () => void; onBrowse: (type: string) => void };
function ProductSection({ section, ...props }: Props & { section: typeof sections[number] }) {
  const { school, savedIds, onSave, onContact, onSchool, onBrowse } = props;
  const { products, loading, error, retry } = useProductSearch(new URLSearchParams({ section: section.type, school, pageSize: String(section.size) }).toString());
  return <section className={`figma-market-section ${section.type}`} data-motion-id={section.id} aria-busy={loading}>
    <div className="figma-section-container">
      <div className="figma-section-heading"><div><span className="section-kicker">{section.kicker}</span><h2>{section.title}</h2><p>{section.description}</p></div><button className="figma-button" onClick={() => section.type === "near" ? onSchool() : onBrowse(section.type)}>{section.action}<Icon name="arrowUp" size={18}/></button></div>
      {section.type === "near" && <button className="figma-university-panel" onClick={onSchool}><Icon name="school"/><span><strong>{school || "Chọn trường đại học của bạn"}</strong><small>Xem tin đăng và hẹn trao đổi gần trường</small></span><span className="figma-button">Đổi trường <Icon name="chevron" size={16}/></span></button>}
      {loading ? <div className="section-loading"><LoadingIndicator label="Đang tìm món đồ cho bạn…" /><CardSkeletons count={section.size} threeColumns={["study", "dorm"].includes(section.type)} /></div> : error ? <div role="alert"><p>{error}</p><button className="figma-button" onClick={retry}>Thử lại</button></div> : products.length ? <div className={`figma-card-grid ${["study","dorm"].includes(section.type) ? "three-columns" : ""}`}>{products.map((item,index) => <MarketplaceCard motionId={figmaCardMotion[section.type as keyof typeof figmaCardMotion]?.[index]} key={item.id} item={item} saved={savedIds.includes(String(item.id))} onSave={onSave} onContact={onContact}/>)}</div> : <EmptyState title="Chưa có món đồ trong mục này">Tin đăng mới sẽ xuất hiện ở đây khi được duyệt.</EmptyState>}
    </div>
  </section>;
}
export default function HomeProductSections(props: Props) {
  return <>{sections.map(section => <ProductSection key={section.id} section={section} {...props}/>)}<section className="figma-post-invitation"><div className="figma-section-container"><div><h2>Bạn không dùng nữa? Có người đang cần.</h2><p>Đăng tin miễn phí, tìm cho món đồ một hành trình mới cùng SangTay.</p></div><Link className="figma-button primary" href="/create-listing">Đăng tin miễn phí <Icon name="plus" size={18}/></Link></div></section></>;
}
