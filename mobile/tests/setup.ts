jest.mock("expo-secure-store", () => {
  const values = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "when-unlocked-this-device-only",
    getItemAsync: jest.fn(async (key: string) => values.get(key) || null),
    setItemAsync: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { values.delete(key); }),
  };
});
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() } }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
