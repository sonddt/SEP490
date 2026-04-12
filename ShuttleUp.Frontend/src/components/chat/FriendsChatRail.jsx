import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import socialApi from '../../api/socialApi';

function useDesktopRail() {
  const [ok, setOk] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 992px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 992px)');
    const fn = () => setOk(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return ok;
}

/**
 * Thanh avatar bạn bè bên phải (desktop) — bấm để mở mini chat.
 */
export default function FriendsChatRail() {
  const { pathname } = useLocation();
  const desktop = useDesktopRail();
  const { openChatWithPeer, openingPeerId } = useChat();
  const [friends, setFriends] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const f = await socialApi.getFriends();
      setFriends(Array.isArray(f) ? f : []);
    } catch {
      setFriends([]);
    }
  }, []);

  const panelOpen = desktop && open;

  if (!desktop || pathname.startsWith('/manager') || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1190,
        display: 'flex',
        flexDirection: 'row-reverse',
        alignItems: 'stretch',
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          type="button"
          title={open ? 'Thu gọn' : 'Bạn bè — chat nhanh'}
          onClick={() => {
            setOpen((o) => {
              const next = !o;
              if (next) load();
              return next;
            });
          }}
          className="btn btn-primary btn-sm shadow"
          style={{
            borderRadius: '12px 0 0 12px',
            padding: '10px 6px',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          💬 Bạn bè
        </button>
      </div>

      {panelOpen && (
        <div
          style={{
            pointerEvents: 'auto',
            marginRight: 4,
            background: '#fff',
            borderRadius: '10px 0 0 10px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            padding: '10px 8px',
            maxHeight: 'min(420px, 70vh)',
            overflowY: 'auto',
            width: 200,
          }}
        >
          <div className="small text-muted mb-2 fw-bold">Mở chat</div>
          {friends.length === 0 && (
            <p className="small text-muted mb-0">Chưa có bạn bè.</p>
          )}
          <ul className="list-unstyled mb-0 small">
            {friends.map((x) => {
              const id = x.id ?? x.Id;
              const name = x.fullName ?? x.FullName ?? '';
              const av = x.avatarUrl ?? x.AvatarUrl;
              const busy = openingPeerId === String(id);
              return (
                <li key={id} className="mb-2">
                  <button
                    type="button"
                    className="btn btn-light w-100 text-start d-flex align-items-center gap-2 py-2"
                    disabled={busy}
                    onClick={() =>
                      openChatWithPeer({
                        userId: id,
                        fullName: name,
                        avatarUrl: av,
                      })
                    }
                  >
                    {av ? (
                      <img
                        src={av}
                        alt=""
                        className="rounded-circle"
                        style={{ width: 36, height: 36, objectFit: 'cover' }}
                      />
                    ) : (
                      <span
                        className="rounded-circle bg-secondary d-inline-flex align-items-center justify-content-center text-white"
                        style={{ width: 36, height: 36, fontSize: 14 }}
                      >
                        {(name || '?').charAt(0)}
                      </span>
                    )}
                    <span className="text-truncate">{busy ? 'Đang mở…' : name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
