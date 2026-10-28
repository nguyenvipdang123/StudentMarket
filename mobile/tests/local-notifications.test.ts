import { localNotifications } from "../src/api/local-notifications.native";
import { Platform } from "react-native";
import { getPermissionsAsync, requestPermissionsAsync } from "expo-notifications/build/NotificationPermissions";
import { setNotificationChannelAsync } from "expo-notifications/build/setNotificationChannelAsync";
import { scheduleNotificationAsync } from "expo-notifications/build/scheduleNotificationAsync";
import { getAllScheduledNotificationsAsync } from "expo-notifications/build/getAllScheduledNotificationsAsync";
import { getPresentedNotificationsAsync } from "expo-notifications/build/getPresentedNotificationsAsync";
import { cancelScheduledNotificationAsync } from "expo-notifications/build/cancelScheduledNotificationAsync";
import { dismissNotificationAsync } from "expo-notifications/build/dismissNotificationAsync";

// Reproduce Expo Go: the remote-push entry cannot be loaded. Local APIs exist.
jest.mock("expo-notifications", () => { throw Error("Cannot find native module 'ExpoTopicSubscriptionModule'"); });
jest.mock("expo-notifications/build/NotificationsHandler", () => ({ setNotificationHandler: jest.fn() }));
jest.mock("expo-notifications/build/NotificationPermissions", () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));
jest.mock("expo-notifications/build/setNotificationChannelAsync", () => ({ setNotificationChannelAsync: jest.fn(async () => null) }));
jest.mock("expo-notifications/build/scheduleNotificationAsync", () => ({ scheduleNotificationAsync: jest.fn(async () => "price-change") }));
jest.mock("expo-notifications/build/getAllScheduledNotificationsAsync", () => ({ getAllScheduledNotificationsAsync: jest.fn(async () => []) }));
jest.mock("expo-notifications/build/getPresentedNotificationsAsync", () => ({ getPresentedNotificationsAsync: jest.fn(async () => []) }));
jest.mock("expo-notifications/build/cancelScheduledNotificationAsync", () => ({ cancelScheduledNotificationAsync: jest.fn(async () => {}) }));
jest.mock("expo-notifications/build/dismissNotificationAsync", () => ({ dismissNotificationAsync: jest.fn(async () => {}) }));

beforeEach(() => { jest.replaceProperty(Platform, "OS", "android"); });
afterEach(() => { jest.restoreAllMocks(); });

test("Expo Go loads local notifications without importing the missing push-topic module", async () => {
  expect(localNotifications.supported).toBe(true);
  expect(await localNotifications.permission(false)).toBe(false);
  expect(requestPermissionsAsync).not.toHaveBeenCalled();
  expect(await localNotifications.permission(true)).toBe(true);
  expect(getPermissionsAsync).toHaveBeenCalledTimes(2);
  expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(setNotificationChannelAsync).toHaveBeenCalledWith("favorite-price-changes", expect.objectContaining({ name: "Giá món đã lưu" }));
  await localNotifications.present("account:price-change", { id: "listing", title: "Bàn học", before: 50000, after: 40000 });
  expect(scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    identifier: "account:price-change",
    content: expect.objectContaining({ data: { kind: "favorite-price", listingId: "listing" }, body: "Bàn học: 50.000đ → 40.000đ." }),
    trigger: { channelId: "favorite-price-changes" },
  }));
});

test("sign-out clears only this account's local price notifications", async () => {
  jest.mocked(getAllScheduledNotificationsAsync).mockResolvedValueOnce([
    { identifier: "account:queued" }, { identifier: "other:queued" },
  ] as Awaited<ReturnType<typeof getAllScheduledNotificationsAsync>>);
  jest.mocked(getPresentedNotificationsAsync).mockResolvedValueOnce([
    { request: { identifier: "account:shown" } }, { request: { identifier: "other:shown" } },
  ] as Awaited<ReturnType<typeof getPresentedNotificationsAsync>>);
  await localNotifications.clear("account:");
  expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("account:queued");
  expect(dismissNotificationAsync).toHaveBeenCalledTimes(1);
  expect(dismissNotificationAsync).toHaveBeenCalledWith("account:shown");
});
