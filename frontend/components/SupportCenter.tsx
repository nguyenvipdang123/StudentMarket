"use client";
import {useEffect,useState} from 'react';
import Link from '@/components/TransitionLink';
import Navbar from './Navbar';
import Footer from './Footer';
import SupportTickets from './SupportTickets';
import AuthDialog from './AuthDialog';
import type {Viewer} from '@/lib/types';
import styles from './SupportCenter.module.css';
const questions=[
  ['Làm sao để tin đăng được hiển thị?','Sau khi gửi, tin được kiểm duyệt trước khi xuất hiện trên sàn. Bạn xem trạng thái và lý do cần chỉnh sửa trong Tin đăng của tôi. Góp ý AI trước khi đăng giúp nội dung rõ hơn, không thay thế bước kiểm duyệt.'],
  ['Tôi chưa nhận được mã xác thực email?','Kiểm tra địa chỉ email đã nhập, hộp thư đến và thư rác. Đợi hết thời gian chờ rồi chọn gửi lại mã. Với Quên mật khẩu, chỉ tài khoản đã đăng ký đủ điều kiện mới nhận được email. Không chia sẻ mã OTP với bất kỳ ai.'],
  ['Đã chuyển khoản nhưng gói đẩy tin chưa kích hoạt?','Kiểm tra mã đơn, số tiền và nội dung chuyển khoản. Mở lại trang thanh toán để kiểm tra trạng thái. Nếu cần đối soát, giữ biên lai và gửi phiếu ở nhóm Thanh toán đẩy tin kèm mã đơn, thời điểm chuyển và số tiền. Không chuyển thêm cho cùng một đơn.'],
  ['Giữ chỗ và đặt lịch giao dịch hoạt động thế nào?','Trao đổi với người bán và gửi lịch hẹn trong mục Giao dịch. Kiểm tra địa điểm, thời gian và trạng thái xác nhận của hai bên trước khi đi. Giữ chỗ không đồng nghĩa đã thanh toán cho món đồ.'],
  ['Xác nhận hoàn tất giao dịch và đánh giá ở đâu?','Sau buổi hẹn, vào Giao dịch để xác nhận đã giao nhận. Khi cả hai bên cùng xác nhận, đánh giá có thể gắn với giao dịch hoàn tất. Chỉ xác nhận sau khi thực sự kiểm tra và nhận món đồ.'],
  ['Tôi muốn báo cáo tin đăng hoặc người dùng vi phạm?','Dùng nút Báo cáo trên tin đăng hoặc trong cuộc trò chuyện để gửi đúng ngữ cảnh cho Admin. Trung tâm hỗ trợ dùng cho vướng mắc khi sử dụng website; không thay thế việc báo cáo vi phạm.'],
];
export default function SupportCenter(){
  const [viewer,setViewer]=useState<Viewer|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [authOpen,setAuthOpen]=useState(false);
  const [authVersion,setAuthVersion]=useState(0);
  useEffect(()=>{const update=()=>{setLoading(true);setError('');setViewer(null);setAuthVersion(x=>x+1);};window.addEventListener('sangtay_auth_changed',update);return()=>window.removeEventListener('sangtay_auth_changed',update);},[]);
  useEffect(()=>{const controller=new AbortController();fetch('/api/auth/me',{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('Chưa kiểm tra được phiên đăng nhập. Vui lòng tải lại trang.');return response.json();}).then(data=>setViewer(data.user)).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[authVersion]);
  return <div className={styles.root}><Navbar/><main><section className={styles.hero}><div className="container"><span className={styles.kicker}>SANGTAY LUÔN SẴN SÀNG LẮNG NGHE</span><h1>Trung tâm hỗ trợ</h1><p>Tìm lời giải cho vướng mắc, giao dịch an toàn hơn và trao đổi với Admin trong cùng một nơi.</p><nav aria-label="Mục hỗ trợ" className={styles.jumpLinks}><a href="#cau-hoi">Câu hỏi thường gặp</a><a href="#an-toan">Giao dịch an toàn</a><a href="#phieu-ho-tro">Yêu cầu hỗ trợ</a></nav></div></section>
    <div className={`container ${styles.main}`}><div className={styles.publicSections}><section className={styles.card} id="cau-hoi"><span className={styles.kicker}>TỰ TÌM CÂU TRẢ LỜI</span><h2>Câu hỏi thường gặp</h2><div className={styles.faq}>{questions.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <section className={styles.card} id="an-toan"><span className={styles.kicker}>HẸN GẶP AN TÂM HƠN</span><h2>Hướng dẫn giao dịch an toàn</h2><div className={styles.safety}><article><span>01 · TRƯỚC KHI HẸN</span><h3>Trao đổi trên SangTay</h3><p>Xem mô tả, ảnh và hồ sơ người bán. Hỏi rõ tình trạng và phụ kiện. Cẩn trọng khi có yêu cầu đặt cọc gấp hoặc chuyển sang đường dẫn lạ.</p></article><article><span>02 · KHI GẶP MẶT</span><h3>Kiểm tra rồi thanh toán</h3><p>Hẹn ở khu vực công cộng có người qua lại; có thể rủ bạn đi cùng. Kiểm tra món đồ và thỏa thuận trực tiếp trước khi trả tiền. Kiểm tra số dư ngân hàng thay vì chỉ tin ảnh biên lai.</p></article><article><span>03 · SAU GIAO DỊCH</span><h3>Giữ lại thông tin trao đổi</h3><p>Lưu lịch hẹn và biên nhận cần thiết. Chỉ xác nhận hoàn tất khi đã giao nhận thật. Nếu phát hiện bất thường, dừng giao dịch và báo cáo đúng tin đăng hoặc cuộc trò chuyện.</p></article></div><p>Không chia sẻ mật khẩu, OTP hoặc cài ứng dụng theo yêu cầu của người lạ. Thanh toán SePay trên website dành cho gói đẩy tin; việc mua món đồ do hai bên thỏa thuận trực tiếp.</p></section>
    <section id="phieu-ho-tro" className={styles.card}><h2>Yêu cầu hỗ trợ</h2><p>Theo dõi phản hồi và tiến độ ngay tại đây. Khi Admin trả lời, bạn sẽ nhận được thông báo trên website.</p>{loading?<p role="status">Đang kiểm tra tài khoản…</p>:error?<p role="alert">{error}</p>:viewer?.role==='student'&&viewer.status==='verified'?null:viewer?.role==='admin'?<Link className="figma-button" href="/admin?tab=SUPPORT">Mở phiếu trong Admin</Link>:<div className={styles.loginBox}><p>Bạn cần tài khoản sinh viên đã xác minh để tạo và theo dõi phiếu.</p><button type="button" className="figma-button" onClick={()=>setAuthOpen(true)}>Đăng nhập để gửi hỗ trợ</button></div>}</section></div>
    {viewer?.role==='student'&&viewer.status==='verified'&&<SupportTickets/>}</div>
    </main><Footer/>{authOpen&&<AuthDialog initialMode="login" onClose={()=>setAuthOpen(false)} onAuthenticated={()=>{setAuthOpen(false);window.dispatchEvent(new Event('sangtay_auth_changed'));window.dispatchEvent(new Event('sangtay_saved_changed'));}}/>}</div>;
}
