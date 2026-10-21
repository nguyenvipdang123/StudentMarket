import type {Metadata} from 'next';
import SupportCenter from '@/components/SupportCenter';
export const metadata:Metadata={title:'Trung tâm hỗ trợ | SangTay',description:'Câu hỏi thường gặp, hướng dẫn giao dịch an toàn và theo dõi yêu cầu hỗ trợ trên SangTay.'};
export default function SupportPage(){return <SupportCenter/>;}
