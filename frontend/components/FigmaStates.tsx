/* Native images preserve Figma asset geometry. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./FigmaIcon";
export function EmptyState({ title, children, action, href, onAction }: { title: string; children?: ReactNode; action?: string; href?: string; onAction?: () => void }) {
  return <div className="figma-empty"><img src="/figma/27-67322-imgFriendlyIllustration.png" width={180} height={140} alt="" /><h2>{title}</h2><p>{children}</p>{action && (href ? <Link className="figma-button primary" href={href}>{action}<Icon name="arrowWhite" /></Link> : <button className="figma-button primary" onClick={onAction}>{action}<Icon name="arrowWhite" /></button>)}</div>;
}
export function SafetyNote({ children }: { children: ReactNode }) { return <div className="figma-safety"><Icon name="shield" /><p>{children}</p></div>; }
export function PageIntro({ title, children }: { title: string; children?: ReactNode }) { return <div className="figma-page-intro"><span className="section-kicker">SANGTAY · CỘNG ĐỒNG SINH VIÊN</span><h1>{title}</h1>{children && <p>{children}</p>}</div>; }
export function CardSkeletons({ count = 4 }: { count?: number }) { return <div className="figma-card-grid" aria-label="Đang tải món đồ" aria-busy="true">{Array.from({length:count},(_,i)=><div className="listing-skeleton" key={i}><div className="skeleton-image"/><div className="skeleton-body"><i/><i/><i/></div></div>)}</div>; }
