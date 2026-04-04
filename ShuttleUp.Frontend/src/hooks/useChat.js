import { useContext } from 'react';
import { ChatContext } from '../context/chatContext';

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat phải dùng trong ChatProvider');
  return ctx;
}
