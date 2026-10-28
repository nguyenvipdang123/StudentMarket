import { request } from "./client";
import { createChatApi } from "./chat";
export const chatApi = createChatApi(request);
