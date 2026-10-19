import test from "node:test";
import assert from "node:assert/strict";
import { filterListings, normalizeSearch } from "../lib/listing-search.ts";
import { SOUTHERN_UNIVERSITIES, findUniversity, universityMatchesQuery } from "../lib/universities.ts";

const filters = {
  category: "Tất cả", search: "", sort: "featured", kind: "all",
  condition: "", school: "", minPrice: "", maxPrice: "",
};
const listings = [
  { id: "book", title: "Sách Giải Tích", description: "Giáo trình năm nhất", category: "Học tập", price: 120000, condition: "Tốt", location: "Quận 3", school: "ĐH Kinh tế", seller: "An", status: "Active", createdAt: "2026-10-01T00:00:00Z" },
  { id: "lamp", title: "Đèn bàn", description: "Trao đổi với sách", category: "Nội thất", price: 0, condition: "Như mới", location: "Thủ Đức", school: "ĐH Bách khoa", seller: "Bình", status: "Active", createdAt: "2026-10-02T00:00:00Z" },
  { id: "phone", title: "Điện thoại", description: "Máy còn tốt", category: "Công nghệ", price: 500000, condition: "Tốt", location: "Quận 1", school: "ĐH Kinh tế", seller: "Chi", status: "Active", createdAt: "2026-09-30T00:00:00Z", promotion: { priority: 3 } },
  { id: "hidden", title: "Sách bí mật", description: "Không công khai", category: "Học tập", price: 1000, condition: "Tốt", location: "Quận 3", school: "ĐH Kinh tế", seller: "Dũng", status: "Hidden" },
];

test("tìm kiếm tiếng Việt không phân biệt dấu, đ và thứ tự từ", () => {
  assert.equal(normalizeSearch("Đèn bàn"), "den ban");
  assert.deepEqual(filterListings(listings, { ...filters, search: "tich sach" }).map(x => x.id), ["book"]);
  assert.deepEqual(filterListings(listings, { ...filters, search: "den thu duc" }).map(x => x.id), ["lamp"]);
});

test("lọc hình thức, khoảng giá, trường và tình trạng", () => {
  assert.deepEqual(filterListings(listings, { ...filters, kind: "exchange" }).map(x => x.id), ["lamp"]);
  assert.deepEqual(filterListings(listings, { ...filters, kind: "sell", minPrice: "100000", maxPrice: "120000", school: "ĐH Kinh tế", condition: "Tốt" }).map(x => x.id), ["book"]);
  assert.deepEqual(filterListings(listings, { ...filters, minPrice: "500000", maxPrice: "100000" }), []);
});

test("sắp xếp nổi bật và mới nhất có ý nghĩa khác nhau", () => {
  assert.deepEqual(filterListings(listings, filters).map(x => x.id), ["phone", "lamp", "book"]);
  assert.deepEqual(filterListings(listings, { ...filters, sort: "newest" }).map(x => x.id), ["lamp", "book", "phone"]);
});

test("chọn trường nhận diện tên đầy đủ, viết tắt và tên cũ trong tin đăng", () => {
  const schools = [
    { ...listings[0], id: "ueh-full", school: "Đại học Kinh tế TP.HCM" },
    { ...listings[1], id: "ueh-short", school: "ĐH Kinh tế TP.HCM" },
    { ...listings[2], id: "uit", school: "Đại học Công nghệ Thông tin" },
    { ...listings[0], id: "ute-old", school: "ĐH Sư phạm Kỹ thuật TP.HCM" },
  ];
  assert.deepEqual(filterListings(schools, { ...filters, school: "ĐH Kinh tế TP.HCM" }).map(x => x.id).sort(), ["ueh-full", "ueh-short"]);
  assert.deepEqual(filterListings(schools, { ...filters, school: "UIT" }).map(x => x.id), ["uit"]);
  assert.deepEqual(filterListings(schools, { ...filters, school: "ĐH Công nghệ Kỹ thuật TP.HCM" }).map(x => x.id), ["ute-old"]);
  assert.equal(filterListings(schools, filters).length, 4);
  assert.equal(findUniversity("Trường Đại học Kinh tế Thành phố Hồ Chí Minh")?.code, "UEH");
  assert.equal(findUniversity("ĐH HUTECH")?.code, "HUTECH");
  assert.equal(universityMatchesQuery(findUniversity("UEH"), "kinh te"), true);
  assert.equal(universityMatchesQuery(findUniversity("UEH"), "ueh"), true);
});

test("danh sách loại trường Tây Nam Bộ và không gộp nhầm cơ sở FPT Cần Thơ", () => {
  assert.equal(new Set(SOUTHERN_UNIVERSITIES.map(x => x.name)).size, SOUTHERN_UNIVERSITIES.length);
  for (const name of ["ĐH Cần Thơ", "ĐH Trà Vinh", "ĐH Đồng Tháp", "ĐH Nam Cần Thơ", "ĐH Cửu Long", "ĐH An Giang", "ĐH Tiền Giang", "ĐH Bạc Liêu", "ĐH FPT Cần Thơ"]) {
    assert.equal(findUniversity(name), undefined, name);
  }
  assert.equal(findUniversity("ĐH Thủ Dầu Một")?.code, "TDMU");
  assert.equal(findUniversity("ĐH Công nghệ Đồng Nai")?.code, "DNTU");
  const campuses = [
    { ...listings[0], id: "fpt-hcm", school: "ĐH FPT TP.HCM" },
    { ...listings[1], id: "fpt-cantho", school: "ĐH FPT Cần Thơ" },
  ];
  assert.deepEqual(filterListings(campuses, { ...filters, school: "ĐH FPT - cơ sở TP.HCM" }).map(x => x.id), ["fpt-hcm"]);
});
