/** Public FAQ shared from the local PDF chatbot; works without a separate AI service. */
export const FAQ = [
  {
    id: 'greeting',
    questions: ['Xin chào', 'Chào', 'Chào bạn', 'Hello', 'Hi', 'Hey'],
    answer: 'Chào bạn! Mình là trợ lý SangTay. Mình có thể hướng dẫn đăng tin, tìm đồ, nhắn tin cho người bán và giao dịch an toàn.',
  },
  {
    id: 'thanks',
    questions: ['Cảm ơn', 'Cảm ơn bạn', 'Thanks', 'Thank you'],
    answer: 'Rất vui được giúp bạn! Bạn cứ hỏi mình nếu cần thêm hướng dẫn sử dụng SangTay nhé.',
  },
  {
    id: 'about',
    questions: ['SangTay hoạt động như thế nào', 'StudentMarket hoạt động như thế nào', 'SangTay là gì', 'StudentMarket là gì', 'Cách hoạt động', 'Website này là gì'],
    answer: 'SangTay / StudentMarket kết nối sinh viên để mua bán, trao đổi và tặng đồ đã qua sử dụng. Bạn tìm đồ tại /explore, nhắn tin cho người bán rồi thỏa thuận gặp mặt để kiểm tra đồ. Xem hướng dẫn tại /how-it-works.',
  },
  {
    id: 'post-listing',
    questions: ['Làm sao để đăng tin', 'Làm sao để đăng tin trên SangTay', 'Làm sao để đăng tin trên StudentMarket', 'Cách đăng tin', 'Đăng tin như thế nào', 'Tôi muốn đăng tin', 'Hướng dẫn đăng tin', 'Cách đăng bán sản phẩm', 'Làm sao để bán đồ'],
    answer: 'Đăng nhập bằng tài khoản sinh viên rồi chọn “Đăng tin miễn phí” hoặc mở /create-listing. Điền bốn bước: Ảnh → Thông tin → Giá & nơi → Xem lại, sau đó gửi tin. Tin được kiểm tra trước khi xuất hiện trên chợ; bạn quản lý tin tại /my-listings.',
  },
  {
    id: 'posting-fee',
    questions: ['Đăng tin có miễn phí không', 'Đăng tin có mất phí không', 'Đăng tin có tốn phí không', 'Đăng tin có tốn tiền không', 'Phí đăng tin là bao nhiêu', 'Đăng tin miễn phí không'],
    answer: 'Đăng tin trên SangTay là miễn phí. Chọn “Đăng tin miễn phí” hoặc mở /create-listing sau khi đăng nhập để tạo tin.',
  },
  {
    id: 'manage-listings',
    questions: ['Cách sửa tin đăng', 'Làm sao để sửa tin đăng', 'Chỉnh sửa tin đăng ở đâu', 'Quản lý tin đăng ở đâu', 'Xem tin đã đăng ở đâu', 'Tôi muốn sửa tin đăng', 'Cách quản lý tin đăng'],
    answer: 'Đăng nhập rồi mở “Quản lý tin đăng” tại /my-listings. Tại đó bạn xem và chỉnh sửa các tin do mình đăng.',
  },
  {
    id: 'find-items',
    questions: ['Cách tìm sản phẩm', 'Làm sao để tìm sản phẩm', 'Cách tìm đồ', 'Làm sao để tìm đồ', 'Tìm sản phẩm ở đâu', 'Tìm đồ ở đâu', 'Cách lọc sản phẩm'],
    answer: 'Mở /explore, nhập tên món đồ và chọn trường hoặc danh mục phù hợp. Bạn có thể lọc theo giá, tình trạng và hình thức giao dịch rồi mở chi tiết tin để xem thông tin hiện tại.',
  },
  {
    id: 'contact-seller',
    questions: ['Cách liên hệ người bán', 'Làm sao để liên hệ người bán', 'Tôi muốn liên hệ người bán thì làm thế nào', 'Liên hệ người bán như thế nào', 'Cách nhắn tin cho người bán', 'Làm sao để nhắn tin cho người bán', 'Xem tin nhắn ở đâu', 'Tin nhắn ở đâu'],
    answer: 'Mở chi tiết tin đăng rồi dùng nút nhắn tin cho người bán để liên hệ trong website. Xem các cuộc trò chuyện tại /messages và thỏa thuận tình trạng đồ, giá cùng địa điểm gặp trước khi giao dịch.',
  },
  {
    id: 'saved-items',
    questions: ['Xem tin đã lưu ở đâu', 'Tin đã lưu ở đâu', 'Xem sản phẩm đã lưu ở đâu', 'Cách lưu sản phẩm', 'Làm sao để lưu sản phẩm', 'Cách lưu tin đăng'],
    answer: 'Bấm nút lưu trên món đồ bạn quan tâm. Bạn xem lại các tin đã lưu tại mục “Tin đã lưu” hoặc /saved.',
  },
  {
    id: 'safe-trade',
    questions: ['Làm sao để giao dịch an toàn', 'Cách giao dịch an toàn', 'Giao dịch an toàn như thế nào', 'Có nên chuyển tiền cọc trước không', 'Có nên đặt cọc trước không', 'Nên gặp người bán ở đâu', 'Hẹn gặp ở đâu thì an toàn'],
    answer: 'Ưu tiên gặp ban ngày tại nơi công cộng như thư viện, căn tin hoặc sảnh trường. Thỏa thuận rõ tình trạng đồ, giá và thời gian gặp; kiểm tra đồ trực tiếp trước khi thanh toán hoặc trao đổi. Không chuyển tiền cọc trước khi trực tiếp kiểm tra đồ.',
  },
  {
    id: 'trade-types',
    questions: ['Có những hình thức giao dịch nào', 'Có thể trao đổi đồ không', 'Có thể tặng đồ không', 'Cách tặng đồ', 'Cách đăng tin tặng đồ', 'Cách đăng tin trao đổi đồ'],
    answer: 'Khi đăng tin tại /create-listing, bạn có thể chọn “Bán lại”, “Trao đổi” hoặc “Tặng miễn phí”. Điền mô tả và khu vực hẹn gặp; nếu chọn bán lại thì nhập giá.',
  },
] as const;

function normalize(question: string): string {
  return question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/đ/g, 'd').trim().replace(/[.!?,:;]+$/g, '').replace(/\s+/g, ' ').trim()
    .replace(/^(ban oi[, ]+|cho (toi|minh) hoi[: ,]+|vui long )/, '')
    .replace(/ (a|nhe|voi)$/, '').trim();
}

const lookup = new Map<string, typeof FAQ[number]>();
for (const entry of FAQ) for (const question of entry.questions) lookup.set(normalize(question), entry);

export function findFaq(question: string): typeof FAQ[number] | undefined {
  // Match the entire question. Product queries, multiple intents and unknowns go to AI.
  return lookup.get(normalize(question));
}
