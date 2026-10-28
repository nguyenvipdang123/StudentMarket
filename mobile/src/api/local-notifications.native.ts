import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance, IosAuthorizationStatus } from "expo-notifications";
import type { NotificationDevice } from "../state/price-alerts";
const channelId = "favorite-price-changes";
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});
export const localNotifications: NotificationDevice = {
  supported: true,
  async permission(request) {
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync(channelId, { name: "Giá món đã lưu", importance: AndroidImportance.DEFAULT });
    let permissions = await Notifications.getPermissionsAsync();
    if (request && !permissions.granted && permissions.canAskAgain) permissions = await Notifications.requestPermissionsAsync();
    return permissions.granted || permissions.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  },
  async present(identifier, change) {
    const money = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title: "Món đã lưu vừa đổi giá", body: `${change.title}: ${money(change.before)} → ${money(change.after)}.`, data: { kind: "favorite-price", listingId: change.id }, sound: false },
      trigger: Platform.OS === "android" ? { channelId } : null,
    });
  },
  async clear(scope) {
    const [scheduled, presented] = await Promise.all([Notifications.getAllScheduledNotificationsAsync(), Notifications.getPresentedNotificationsAsync()]);
    await Promise.all([
      ...scheduled.filter(n => n.identifier.startsWith(scope)).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      ...presented.filter(n => n.request.identifier.startsWith(scope)).map(n => Notifications.dismissNotificationAsync(n.request.identifier)),
    ]);
  },
};
