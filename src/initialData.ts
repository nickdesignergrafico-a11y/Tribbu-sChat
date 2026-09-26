import { Chat } from './types';

export const TRIBBU_AI_CHAT_ID = 'tribbu-ai';

export const TRIBBU_AI_CHAT: Chat = {
  id: TRIBBU_AI_CHAT_ID,
  name: 'Tribbu AI',
  avatarColor: '#0891b2',
  avatarLetter: '🤖',
  isGroup: false,
  isAI: true,
  online: true,
  statusText: 'Tribbu AI • Assistente Inteligente Online',
  unreadCount: 0,
  messages: []
};

// Permanent virtual contact in the conversation baseline
export const INITIAL_CHATS: Chat[] = [TRIBBU_AI_CHAT];
