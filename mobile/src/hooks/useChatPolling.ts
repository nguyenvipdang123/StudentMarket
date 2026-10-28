import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { createChatPoller } from "../api/chat-polling";

export function useChatPolling(work: (isCurrent: () => boolean) => Promise<boolean | void>, interval: number) {
  const current = useRef<ReturnType<typeof createChatPoller> | null>(null);
  useFocusEffect(useCallback(() => {
    const poller = createChatPoller(work, interval);
    current.current = poller;
    const update = (state: string | null | undefined) => {
      if (state === "active" || state === null || state === undefined) poller.resume();
      else poller.pause();
    };
    const subscription = AppState.addEventListener("change", update);
    update(AppState.currentState);
    return () => {
      poller.dispose();
      subscription.remove();
      if (current.current === poller) current.current = null;
    };
  }, [work, interval]));
  return useCallback(() => current.current?.refresh(), []);
}
