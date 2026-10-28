import { Platform } from "react-native";
// SDK 58's root entry also imports ExpoTopicSubscriptionModule (remote push),
// which is absent in Expo Go. Load only the local notification APIs we use.
import { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
import { getPermissionsAsync, requestPermissionsAsync } from "expo-notifications/build/NotificationPermissions";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import { IosAuthorizationStatus } from "expo-notifications/build/NotificationPermissions.types";
import { setNotificationChannelAsync } from "expo-notifications/build/setNotificationChannelAsync";
import { scheduleNotificationAsync } from "expo-notifications/build/scheduleNotificationAsync";
import { getAllScheduledNotificationsAsync } from "expo-notifications/build/getAllScheduledNotificationsAsync";
import { getPresentedNotificationsAsync } from "expo-notifications/build/getPresentedNotificationsAsync";
import { cancelScheduledNotificationAsync } from "expo-notifications/build/cancelScheduledNotificationAsync";
import { dismissNotificationAsync } from "expo-notifications/build/dismissNotificationAsync";
import type { NotificationDevice } from "../state/price-alerts";
const channelId = "favorite-price-changes";
setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});
export const localNotifications: NotificationDevice = {
  supported: true,
  async permission(request) {
    if (Platform.OS === "android") await setNotificationChannelAsync(channelId, { name: "Giá món đã lưu", importance: AndroidImportance.DEFAULT });
    let permissions = await getPermissionsAsync();
    if (request && !permissions.granted && permissions.canAskAgain) permissions = await requestPermissionsAsync();
    return permissions.granted || permissions.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  },
  async present(identifier, change) {
    const money = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
    await scheduleNotificationAsync({
      identifier,
      content: { title: "Món đã lưu vừa đổi giá", body: `${change.title}: ${money(change.before)} → ${money(change.after)}.`, data: { kind: "favorite-price", listingId: change.id }, sound: false },
      trigger: Platform.OS === "android" ? { channelId } : null,
    });
  },
  async clear(scope) {
    const [scheduled, presented] = await Promise.all([getAllScheduledNotificationsAsync(), getPresentedNotificationsAsync()]);
    await Promise.all([
      ...scheduled.filter(n => n.identifier.startsWith(scope)).map(n => cancelScheduledNotificationAsync(n.identifier)),
      ...presented.filter(n => n.request.identifier.startsWith(scope)).map(n => dismissNotificationAsync(n.request.identifier)),
    ]);
  },
};
