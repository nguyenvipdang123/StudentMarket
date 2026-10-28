import { fireEvent, render, screen } from "@testing-library/react-native";
import Explore from "../src/app/(tabs)/index";
import { ThemeProvider } from "../src/theme";
import type { Product } from "../src/api/types";

jest.mock("expo-router", () => ({ router: { push: jest.fn() }, useFocusEffect(effect: () => void | (() => void)) {
  const React = jest.requireActual<typeof import("react")>("react"); React.useEffect(effect, [effect]);
} }));
const mockRefresh = jest.fn(async () => {});
let mockOffline = false;
const product = (id: string, price: number, condition = "Tốt", school = "DNTU", category = "Học tập"): Product => ({
  id, title: `Sách ${id}`, description: "Sách lập trình còn dùng tốt", price, condition, school, category, location: "Thư viện", seller: "Sinh viên", image: "", status: "Active",
});
const mockProducts = [product("cheap", 50000), product("expensive", 100000), product("new", 75000, "Như mới"), product("other-school", 90000, "Tốt", "UTH"), product("gift", 0, "Tốt", "DNTU", "Khác")];
jest.mock("../src/providers/Market", () => ({
  useCatalogue: () => ({ products: mockProducts, ready: true, busy: false, error: "", offline: mockOffline, stale: mockOffline, savedAt: "2026-10-28T12:00:00Z", refresh: mockRefresh }),
  useAccountMarket: () => ({ cart: [] }),
}));
jest.mock("../src/components/ProductCard", () => ({ ProductCard: ({ item }: { item: Product }) => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native"); return <Text testID="catalog-product">{item.id}</Text>;
} }));
jest.mock("../src/components/SchoolPicker", () => ({ SchoolPicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const { Chips } = jest.requireActual<typeof import("../src/components/UI")>("../src/components/UI");
  return <Chips values={["Tất cả trường", "DNTU", "UTH"]} value={value || "Tất cả trường"} onChange={v => onChange(v === "Tất cả trường" ? "" : v)} />;
} }));
beforeEach(() => { mockOffline = false; mockRefresh.mockClear(); });
const mount = () => render(<ThemeProvider><Explore /></ThemeProvider>);
const ids = () => screen.queryAllByTestId("catalog-product").map(node => node.props.children);

test("price, condition, school and search combine during render, then descending and reset update the catalogue", async () => {
  await mount();
  await fireEvent.press(screen.getByRole("button", { name: "Bộ lọc sản phẩm" }));
  await fireEvent.changeText(screen.getByLabelText("Giá từ (đ)"), "50000");
  await fireEvent.changeText(screen.getByLabelText("Giá đến (đ)"), "100000");
  await fireEvent.press(screen.getByRole("button", { name: "Tốt" }));
  await fireEvent.press(screen.getByRole("button", { name: "DNTU" }));
  await fireEvent.press(screen.getByRole("button", { name: "Học tập" }));
  await fireEvent.changeText(screen.getByLabelText("Tìm kiếm món đồ"), "sach");
  await fireEvent.press(screen.getByRole("button", { name: "Giá giảm dần" }));
  expect(ids()).toEqual(["expensive", "cheap"]);
  expect(screen.getByRole("button", { name: "Giá giảm dần", selected: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Xóa bộ lọc" }));
  expect(ids()).toEqual(mockProducts.map(p => p.id));
  expect(screen.getByLabelText("Giá từ (đ)")).toHaveDisplayValue("");
  expect(screen.getByLabelText("Giá đến (đ)")).toHaveDisplayValue("");
  expect(screen.getByLabelText("Tìm kiếm món đồ")).toHaveDisplayValue("");
  expect(screen.getByRole("button", { name: "Mọi tình trạng", selected: true })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Nổi bật", selected: true })).toBeOnTheScreen();
  expect(mockRefresh).toHaveBeenCalledTimes(1); // Filters never refetch or save derived results.
});

test("invalid price range is visible and editable; empty results can clear every active filter", async () => {
  await mount();
  await fireEvent.press(screen.getByRole("button", { name: "Bộ lọc sản phẩm" }));
  await fireEvent.changeText(screen.getByLabelText("Giá từ (đ)"), "100000");
  await fireEvent.changeText(screen.getByLabelText("Giá đến (đ)"), "50000");
  expect(screen.getByText("Giá từ không được lớn hơn giá đến.")).toBeOnTheScreen();
  expect(ids()).toEqual([]);
  await fireEvent.changeText(screen.getByLabelText("Giá đến (đ)"), "100000");
  expect(ids()).toEqual(["expensive"]);
  await fireEvent.press(screen.getByRole("button", { name: "Mới 100%" }));
  expect(screen.getByText("Chưa tìm thấy món phù hợp")).toBeOnTheScreen();
  // The empty state also offers reset, independently of the expanded panel.
  await fireEvent.press(screen.getByRole("button", { name: "Bộ lọc sản phẩm" }));
  await fireEvent.press(screen.getByRole("button", { name: "Xóa bộ lọc" }));
  expect(ids()).toEqual(mockProducts.map(p => p.id));
});

test("filters and descending sort work offline over the last successful catalogue", async () => {
  mockOffline = true;
  await mount();
  await fireEvent.press(screen.getByRole("button", { name: "Bộ lọc sản phẩm" }));
  await fireEvent.changeText(screen.getByLabelText("Giá đến (đ)"), "0");
  expect(ids()).toEqual(["gift"]);
  await fireEvent.changeText(screen.getByLabelText("Giá đến (đ)"), "");
  await fireEvent.press(screen.getByRole("button", { name: "Giá giảm dần" }));
  expect(ids()).toEqual(["expensive", "other-school", "new", "cheap", "gift"]);
});
