import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import ChatPanel from './ChatPanel';

/**
 * Floating draggable badminton-themed FAB + ChatPanel.
 * Replaces the old vertical edge tab.
 */
export default function FriendsChatRail() {
  const { pathname } = useLocation();
  const { chatPanelOpen, toggleChatPanel } = useChat();

  /* ─── drag state ─────────────────────────────────── */
  const [pos, setPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 140 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const wasDragged = useRef(false);
  const fabRef = useRef(null);

  const clamp = useCallback((x, y) => {
    const size = 56;
    return {
      x: Math.max(8, Math.min(window.innerWidth - size - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - size - 8, y)),
    };
  }, []);

  /* pointer handlers */
  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    wasDragged.current = false;
    const rect = fabRef.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    wasDragged.current = true;
    const next = clamp(e.clientX - offset.current.x, e.clientY - offset.current.y);
    setPos(next);
  }, [clamp]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleClick = useCallback(() => {
    if (wasDragged.current) return;     // ignore click after drag
    toggleChatPanel();
  }, [toggleChatPanel]);

  /* keep inside viewport on resize */
  useEffect(() => {
    const onResize = () => setPos(p => clamp(p.x, p.y));
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  /* Hidden on admin / manager */
  if (pathname.startsWith('/manager') || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      {/* ── Floating Action Button ── */}
      <div
        ref={fabRef}
        className={`shuttle-chat-fab ${chatPanelOpen ? '--active' : ''}`}
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={handleClick}
        title="Mở chat"
      >
        {/* Shuttlecock SVG icon */}
        <svg className="shuttle-chat-fab__icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Cork / base */}
          <circle cx="32" cy="44" r="10" fill="#fff" opacity="0.95" />
          <circle cx="32" cy="44" r="7" fill="rgba(255,255,255,0.6)" />
          {/* Feathers */}
          <path d="M32 34 L22 14 Q27 12 32 16 Z" fill="rgba(255,255,255,0.85)" />
          <path d="M32 34 L28 12 Q32 10 34 14 Z" fill="rgba(255,255,255,0.7)" />
          <path d="M32 34 L42 14 Q37 12 32 16 Z" fill="rgba(255,255,255,0.85)" />
          <path d="M32 34 L36 12 Q32 10 30 14 Z" fill="rgba(255,255,255,0.7)" />
          <path d="M32 34 L20 20 Q24 16 28 20 Z" fill="rgba(255,255,255,0.6)" />
          <path d="M32 34 L44 20 Q40 16 36 20 Z" fill="rgba(255,255,255,0.6)" />
          {/* Chat bubble overlay */}
          <circle cx="44" cy="48" r="10" fill="#fff" />
          <circle cx="44" cy="48" r="8" fill="#10b981" />
          <path d="M40 46 h8 M40 50 h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {/* Pulse ring */}
        <span className="shuttle-chat-fab__pulse"></span>
      </div>

      {/* ── Chat Panel ── */}
      <ChatPanel />
    </>
  );
}
