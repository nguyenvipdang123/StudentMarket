import type { NotificationDevice } from "../state/price-alerts";
// Web preview cannot ask for or fake an Android/iOS local notification.
export const localNotifications: NotificationDevice = {
  supported: false,
  permission: async () => false,
  present: async () => {},
  clear: async () => {},
};
