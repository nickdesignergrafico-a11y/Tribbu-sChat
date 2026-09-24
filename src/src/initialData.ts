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
  messages: [
    {
      id: 'tribbu_ai_welcome_1',
      sender: 'them',
      senderName: 'Tribbu AI',
      senderPhoneNumber: 'tribbu-ai',
      text: 'Olá! Sou o Tribbu AI, seu assistente virtual de inteligência artificial integrado ao Tribbu\'sChat. 🤖⚡\n\nComo posso ajudar você hoje? Pergunte qualquer coisa, peça traduções, análises ou tire suas dúvidas!',
      time: '12:00',
      timestamp: 1710000000000,
      status: 'read',
      type: 'text'
    }
  ]
};

// Permanent virtual contact in the conversation baseline
export const INITIAL_CHATS: Chat[] = [TRIBBU_AI_CHAT];
