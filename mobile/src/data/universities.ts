// School options mirrored from frontend/lib/universities.ts; parity is checked in catalog.test.mjs.
export const UNIVERSITY_STORAGE_KEY = "sangtay_search_university_v1";

export type University = { name: string; code: string; aliases: string[] };

// Chỉ các trường/cơ sở tại TP.HCM và Đông Nam Bộ; không thêm cơ sở Tây Nam Bộ.
// Tên đổi gần đây được đối chiếu tại https://hcmute.edu.vn và https://huit.edu.vn.
// Các trường ngoài TP.HCM: https://eiu.edu.vn, https://tdmu.edu.vn,
// https://dntu.edu.vn, https://bvu.edu.vn.
export const SOUTHERN_UNIVERSITIES: University[] = [
  { name: "ĐH Quốc gia TP.HCM", code: "VNU-HCM", aliases: ["VNUHCM"] },
  { name: "ĐH Kinh tế TP.HCM", code: "UEH", aliases: [] },
  { name: "ĐH Bách khoa TP.HCM", code: "HCMUT", aliases: ["ĐH Bách khoa - ĐHQG TP.HCM"] },
  { name: "ĐH Công nghệ Thông tin", code: "UIT", aliases: ["ĐH Công nghệ Thông tin TP.HCM", "ĐH Công nghệ Thông tin - ĐHQG TP.HCM"] },
  { name: "ĐH Khoa học Tự nhiên TP.HCM", code: "HCMUS", aliases: ["ĐH Khoa học Tự nhiên - ĐHQG TP.HCM"] },
  { name: "ĐH Khoa học Xã hội và Nhân văn TP.HCM", code: "HCMUSSH", aliases: ["ĐH KHXH&NV TP.HCM", "ĐH Khoa học Xã hội và Nhân văn - ĐHQG TP.HCM"] },
  { name: "ĐH Quốc tế - ĐHQG TP.HCM", code: "IU", aliases: ["ĐH Quốc tế TP.HCM"] },
  { name: "ĐH Kinh tế - Luật", code: "UEL", aliases: ["ĐH Kinh tế - Luật TP.HCM", "ĐH Kinh tế - Luật - ĐHQG TP.HCM"] },
  { name: "ĐH Sư phạm TP.HCM", code: "HCMUE", aliases: [] },
  { name: "ĐH Công nghệ Kỹ thuật TP.HCM", code: "HCMUTE", aliases: ["ĐH Sư phạm Kỹ thuật TP.HCM", "SPKT TP.HCM"] },
  { name: "ĐH Tôn Đức Thắng", code: "TDTU", aliases: [] },
  { name: "ĐH Công nghiệp TP.HCM", code: "IUH", aliases: [] },
  { name: "ĐH Công Thương TP.HCM", code: "HUIT", aliases: ["ĐH Công nghiệp Thực phẩm TP.HCM", "HUFI"] },
  { name: "ĐH Tài chính - Marketing", code: "UFM", aliases: [] },
  { name: "ĐH Ngân hàng TP.HCM", code: "HUB", aliases: ["BUH"] },
  { name: "ĐH Luật TP.HCM", code: "ULAW", aliases: [] },
  { name: "ĐH Kiến trúc TP.HCM", code: "UAH", aliases: [] },
  { name: "ĐH Giao thông Vận tải TP.HCM", code: "UTH", aliases: ["ĐH Giao thông vận tải Thành phố Hồ Chí Minh"] },
  { name: "ĐH Tài nguyên và Môi trường TP.HCM", code: "HCMUNRE", aliases: [] },
  { name: "ĐH Nông Lâm TP.HCM", code: "NLU", aliases: ["HCMUAF"] },
  { name: "ĐH Y Dược TP.HCM", code: "UMP", aliases: [] },
  { name: "ĐH Y khoa Phạm Ngọc Thạch", code: "PNTU", aliases: [] },
  { name: "ĐH Mở TP.HCM", code: "OU", aliases: ["HCMCOU"] },
  { name: "ĐH Sài Gòn", code: "SGU", aliases: [] },
  { name: "ĐH Văn hóa TP.HCM", code: "HCMUC", aliases: [] },
  { name: "ĐH Thể dục Thể thao TP.HCM", code: "USH", aliases: [] },
  { name: "ĐH Công nghệ TP.HCM (HUTECH)", code: "HUTECH", aliases: ["ĐH HUTECH", "ĐH Công nghệ TP.HCM"] },
  { name: "ĐH Hoa Sen", code: "HSU", aliases: [] },
  { name: "ĐH Văn Lang", code: "VLU", aliases: [] },
  { name: "ĐH Quốc tế Hồng Bàng", code: "HIU", aliases: ["ĐH Hồng Bàng"] },
  { name: "ĐH Nguyễn Tất Thành", code: "NTTU", aliases: [] },
  { name: "ĐH Kinh tế - Tài chính TP.HCM", code: "UEF", aliases: [] },
  { name: "ĐH Ngoại ngữ - Tin học TP.HCM", code: "HUFLIT", aliases: [] },
  { name: "ĐH Công nghệ Sài Gòn", code: "STU", aliases: [] },
  { name: "ĐH Gia Định", code: "GDU", aliases: [] },
  { name: "ĐH Văn Hiến", code: "VHU", aliases: [] },
  { name: "ĐH Hùng Vương TP.HCM", code: "DHV", aliases: [] },
  { name: "ĐH Quản lý và Công nghệ TP.HCM", code: "UMT", aliases: [] },
  { name: "ĐH FPT - cơ sở TP.HCM", code: "FPT", aliases: ["ĐH FPT", "ĐH FPT TP.HCM"] },
  { name: "ĐH RMIT - cơ sở Nam Sài Gòn", code: "RMIT", aliases: ["ĐH RMIT TP.HCM", "ĐH RMIT", "RMIT Nam Sài Gòn"] },
  { name: "ĐH Fulbright Việt Nam", code: "FUV", aliases: [] },
  { name: "ĐH Thủ Dầu Một", code: "TDMU", aliases: [] },
  { name: "ĐH Bình Dương", code: "BDU", aliases: [] },
  { name: "ĐH Quốc tế Miền Đông", code: "EIU", aliases: [] },
  { name: "ĐH Việt Đức", code: "VGU", aliases: ["ĐH Việt - Đức"] },
  { name: "ĐH Kinh tế - Kỹ thuật Bình Dương", code: "BETU", aliases: [] },
  { name: "ĐH Đồng Nai", code: "DNU", aliases: [] },
  { name: "ĐH Lạc Hồng", code: "LHU", aliases: [] },
  { name: "ĐH Công nghệ Đồng Nai", code: "DNTU", aliases: [] },
  { name: "ĐH Công nghệ Miền Đông", code: "MITU", aliases: [] },
  { name: "ĐH Bà Rịa - Vũng Tàu", code: "BVU", aliases: [] },
  { name: "ĐH Dầu khí Việt Nam", code: "PVU", aliases: [] },
].sort((a, b) => a.name.localeCompare(b.name, "vi"));

export function normalizeUniversity(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
    .toLowerCase().replace(/&/g, " va ").replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:truong )?dai hoc\b/g, "dh")
    .replace(/\btruong dh\b/g, "dh")
    .replace(/\b(?:thanh pho|tp) ho chi minh\b/g, "tp hcm")
    .replace(/\btphcm\b/g, "tp hcm").trim().replace(/\s+/g, " ");
}

export function findUniversity(value: string): University | undefined {
  const normalized = normalizeUniversity(value);
  if (!normalized) return undefined;
  return SOUTHERN_UNIVERSITIES.find(university =>
    [university.name, university.code, ...university.aliases].some(name => normalizeUniversity(name) === normalized));
}

export function universityMatchesQuery(university: University, query: string): boolean {
  const words = normalizeUniversity(query).split(" ").filter(Boolean);
  return [university.name, university.code, ...university.aliases].some(name => {
    const normalized = normalizeUniversity(name);
    return words.every(word => normalized.includes(word));
  });
}

export function schoolMatchesUniversity(school: string, selected: string): boolean {
  if (!selected) return true;
  const target = findUniversity(selected);
  return target ? findUniversity(school)?.name === target.name : normalizeUniversity(school) === normalizeUniversity(selected);
}
