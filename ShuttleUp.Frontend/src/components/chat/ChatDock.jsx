import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import MiniChatWindow from './MiniChatWindow';
import FriendsChatRail from './FriendsChatRail';

const GAP = 8;
const PAD = 16;
const BASE_W = 312;
const MIN_W = 168;
const RAIL_W = 56;

function useWindowWidth() {
  const [w, setW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}

function useRailPad() {
  const [pad, setPad] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 992px)');
    const fn = () => setPad(mq.matches ? RAIL_W : 0);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return pad;
}

export default function ChatDock() {
  const { pathname } = useLocation();
  const { windows, closeWindow, toggleMinimize, bringToFront } = useChat();
  const vw = useWindowWidth();
  const railPad = useRailPad();

  if (pathname.startsWith('/manager') || pathname.startsWith('/admin')) {
    return null;
  }

  const { boxWidth, ordered } = useMemo(() => {
    const n = windows.length;
    const orderedInner = [...windows].sort((a, b) => b.z - a.z);
    if (n === 0) return { boxWidth: BASE_W, ordered: orderedInner };
    const avail = vw - PAD * 2 - railPad - Math.max(0, n - 1) * GAP;
    const raw = Math.floor(avail / n);
    const boxW = Math.max(MIN_W, Math.min(BASE_W, raw));
    return { boxWidth: boxW, ordered: orderedInner };
  }, [windows, vw, railPad]);

  return (
    <>
      <FriendsChatRail />
      {ordered.map((win, idx) => {
        const n = ordered.length;
        return (
          <MiniChatWindow
            key={String(win.roomId)}
            win={win}
            boxWidth={boxWidth}
            rightOffset={PAD + railPad + idx * (boxWidth + GAP)}
            zIndex={1250 + (n - 1 - idx)}
            onClose={closeWindow}
            onToggleMin={toggleMinimize}
            onBringFront={bringToFront}
          />
        );
      })}
    </>
  );
}
