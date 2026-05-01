import { useLocation } from 'react-router-dom';
import FriendsChatRail from './FriendsChatRail';

/**
 * ChatDock — renders the floating FAB + ChatPanel.
 * MiniChatWindow popups have been removed.
 */
export default function ChatDock() {
  const { pathname } = useLocation();

  if (pathname.startsWith('/manager') || pathname.startsWith('/admin')) {
    return null;
  }

  return <FriendsChatRail />;
}
