// ─── Chat Store ───

import { create } from 'zustand';

export type ChatChannel = 'global' | 'team' | 'local' | 'system';

export interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  channel: ChatChannel;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  addMessage: (sender: string, message: string, channel: ChatChannel) => void;
  toggleChat: () => void;
  setOpen: (open: boolean) => void;
  clearMessages: () => void;
}

let msgCounter = 0;

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isOpen: false,

  addMessage: (sender, message, channel) =>
    set((s) => ({
      messages: [
        ...s.messages.slice(-99),
        {
          id: `msg-${++msgCounter}`,
          sender,
          message,
          channel,
          timestamp: Date.now(),
        },
      ],
    })),

  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  clearMessages: () => set({ messages: [] }),
}));