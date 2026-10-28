import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, AppState, type AppStateStatus } from "react-native";
import Post from "../src/app/(tabs)/post";
import { ThemeProvider } from "../src/theme";
import { draftStorageKey, type ListingDraftStore } from "../src/state/listing-draft";
import { request } from "../src/api/client";
import * as ImagePicker from "expo-image-picker";

jest.mock("expo-image", () => ({ Image: "Image" }));
const mockStudent = { id: 1, pgUserId: "seller", fullName: "Người bán", role: "student", university: "DNTU" };
let mockUser = mockStudent;
let mockOffline = false;
jest.mock("../src/providers/Session", () => ({ useSession: () => ({ user: mockUser, ready: true }) }));
jest.mock("../src/providers/Market", () => ({ useCatalogue: () => ({ offline: mockOffline }) }));
jest.mock("../src/api/client", () => ({ request: jest.fn(), message: (e: Error) => e.message }));
jest.mock("../src/api/photos", () => ({
  compressPhoto: jest.fn(async () => ({ uri: "cache://photo", fileName: "photo.jpg", mimeType: "image/jpeg", fileSize: 1000, width: 800, height: 600 })),
  appendPhotos: jest.fn(async () => {}),
}));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn(), launchCameraAsync: jest.fn(), requestCameraPermissionsAsync: jest.fn() }));
const mockDisk = new Map<string, string>();
const mockFiles = new Map<string, object>();
const mockStores = new Map<string, ListingDraftStore>();
let mockWriteFailure = false;
jest.mock("../src/api/listing-drafts", () => ({ listingDraftStore: (actor: string) => {
  const { createListingDraftStore } = jest.requireActual<typeof import("../src/state/listing-draft")>("../src/state/listing-draft");
  let store = mockStores.get(actor);
  if (!store) {
    store = createListingDraftStore({ getItem: async key => mockDisk.get(key) || null, setItem: async (key, value) => { if (mockWriteFailure) throw Error("Disk full"); mockDisk.set(key, value); } }, {
      retain: async photo => { const saved = { ...photo, uri: `documents://${actor}/photo.jpg` }; mockFiles.set(saved.uri, saved); return saved; },
      inspect: async photo => mockFiles.has(photo.uri) ? photo : null,
      prune: async keep => { for (const uri of mockFiles.keys()) if (uri.startsWith(`documents://${actor}/`) && !keep.includes(uri)) mockFiles.delete(uri); },
    }, `https://sangtay.shop:${actor}`);
    mockStores.set(actor, store);
  }
  return store;
} }));
beforeEach(() => {
  mockUser = mockStudent; mockOffline = false; mockWriteFailure = false; mockDisk.clear(); mockFiles.clear(); mockStores.clear();
  jest.mocked(request).mockReset();
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: "camera://fixture", width: 1000, height: 800 }] });
});
afterEach(() => jest.restoreAllMocks());
const mount = () => render(<ThemeProvider><Post /></ThemeProvider>);
const titleField = () => screen.findByLabelText("Tên món đồ *");

test("save incomplete offline draft with a picked photo, restart, and restore the same account only", async () => {
  mockOffline = true;
  const view = await mount(); await titleField();
  await fireEvent.changeText(screen.getByLabelText("Tên món đồ *"), "B");
  await fireEvent.press(screen.getByRole("button", { name: "Chọn ảnh từ thiết bị" }));
  await screen.findByRole("button", { name: "Xóa ảnh 1" });
  await fireEvent.press(screen.getByRole("button", { name: "Lưu bản nháp" }));
  await act(async () => { await mockStores.get("seller")!.save(); });
  expect(request).not.toHaveBeenCalled();
  await view.unmount(); mockStores.clear(); // A fresh JS process, retaining only the disk/files.
  const restored = await mount(); await titleField();
  expect(screen.getByLabelText("Tên món đồ *")).toHaveDisplayValue("B");
  expect(screen.getByRole("button", { name: "Xóa ảnh 1" })).toBeOnTheScreen();
  expect(screen.getByText(/Đã lưu nháp lúc/)).toBeOnTheScreen();
  mockUser = { ...mockStudent, pgUserId: "other" };
  await restored.rerender(<ThemeProvider><Post /></ThemeProvider>); await titleField();
  expect(screen.getByLabelText("Tên món đồ *")).toHaveDisplayValue("");
  expect(screen.queryByRole("button", { name: "Xóa ảnh 1" })).not.toBeOnTheScreen();
});

test("POST failure retains the draft/photo; only a confirmed success clears local data", async () => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.mocked(request).mockRejectedValueOnce(Error("Mất kết nối")).mockResolvedValueOnce({ success: true });
  await mount(); await titleField();
  await fireEvent.changeText(screen.getByLabelText("Tên món đồ *"), "Đèn bàn học");
  await fireEvent.changeText(screen.getByLabelText("Mô tả món đồ *"), "Đèn còn dùng rất tốt");
  await fireEvent.changeText(screen.getByLabelText("Giá bán (đ) *"), "50000");
  await fireEvent.press(screen.getByRole("button", { name: "Chọn ảnh từ thiết bị" }));
  await screen.findByRole("button", { name: "Xóa ảnh 1", disabled: false });
  await fireEvent.press(screen.getByRole("button", { name: "Gửi tin đăng" }));
  await screen.findByText("Mất kết nối");
  expect(screen.getByLabelText("Tên món đồ *")).toHaveDisplayValue("Đèn bàn học");
  expect(mockFiles.size).toBe(1);
  await fireEvent.press(screen.getByRole("button", { name: "Thử gửi lại" }));
  await screen.findByText("Đã gửi tin đăng");
  expect(request).toHaveBeenCalledTimes(2);
  expect(mockFiles.size).toBe(0);
  const manifest = JSON.parse(mockDisk.get(draftStorageKey("https://sangtay.shop:seller"))!);
  expect(manifest.draft.title).toBe(""); expect(manifest.photos).toEqual([]);
});

test("discard asks for confirmation, and backgrounding flushes edits without a network request", async () => {
  let background: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => { background = handler; return { remove: jest.fn() }; });
  const confirm = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await mount(); await titleField();
  await fireEvent.changeText(screen.getByLabelText("Tên món đồ *"), "Giữ nháp này");
  await act(async () => { background?.("background"); await mockStores.get("seller")!.save(); });
  expect(JSON.parse(mockDisk.get(draftStorageKey("https://sangtay.shop:seller"))!).draft.title).toBe("Giữ nháp này");
  await fireEvent.press(screen.getByRole("button", { name: "Bỏ bản nháp" }));
  expect(screen.getByLabelText("Tên món đồ *")).toHaveDisplayValue("Giữ nháp này");
  await act(async () => { confirm.mock.calls.at(-1)?.[2]?.find(b => b.style === "destructive")?.onPress?.(); await mockStores.get("seller")!.save(); });
  expect(screen.getByLabelText("Tên món đồ *")).toHaveDisplayValue("");
  expect(request).not.toHaveBeenCalled();
});

test("successful POST with failed local cleanup offers cleanup retry, never a second POST", async () => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.mocked(request).mockResolvedValue({ success: true });
  await mount(); await titleField();
  await fireEvent.changeText(screen.getByLabelText("Tên món đồ *"), "Đèn bàn học");
  await fireEvent.changeText(screen.getByLabelText("Mô tả món đồ *"), "Đèn còn dùng rất tốt");
  await fireEvent.changeText(screen.getByLabelText("Giá bán (đ) *"), "50000");
  await fireEvent.press(screen.getByRole("button", { name: "Chọn ảnh từ thiết bị" }));
  await screen.findByRole("button", { name: "Xóa ảnh 1", disabled: false });
  mockWriteFailure = true;
  await fireEvent.press(screen.getByRole("button", { name: "Gửi tin đăng" }));
  await screen.findByRole("button", { name: "Thử xóa nháp đã gửi", disabled: false });
  expect(screen.queryByRole("button", { name: "Thử gửi lại" })).not.toBeOnTheScreen();
  expect(mockFiles.size).toBe(1);
  mockWriteFailure = false;
  await fireEvent.press(screen.getByRole("button", { name: "Thử xóa nháp đã gửi" }));
  await act(async () => { await mockStores.get("seller")!.save(); });
  expect(mockFiles.size).toBe(0); expect(request).toHaveBeenCalledTimes(1);
});

test("a late image picker result after account change cannot attach photos to either account", async () => {
  let finish: (result: ImagePicker.ImagePickerResult) => void = () => {};
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = await mount(); await titleField();
  await fireEvent.press(screen.getByRole("button", { name: "Chọn ảnh từ thiết bị" }));
  mockUser = { ...mockStudent, pgUserId: "other" };
  await view.rerender(<ThemeProvider><Post /></ThemeProvider>); await titleField();
  await act(async () => { finish({ canceled: false, assets: [{ uri: "camera://fixture", width: 800, height: 600 }] }); });
  expect(mockFiles.size).toBe(0);
  expect(screen.queryByRole("button", { name: "Xóa ảnh 1" })).not.toBeOnTheScreen();
});

test("restore error offers a real local-data retry without attempting a network submission", async () => {
  mockDisk.set(draftStorageKey("https://sangtay.shop:seller"), "{bad json");
  await mount();
  await screen.findByRole("button", { name: "Thử lại" });
  expect(screen.queryByLabelText("Tên món đồ *")).not.toBeOnTheScreen();
  mockDisk.delete(draftStorageKey("https://sangtay.shop:seller"));
  await fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  await titleField(); expect(request).not.toHaveBeenCalled();
});
