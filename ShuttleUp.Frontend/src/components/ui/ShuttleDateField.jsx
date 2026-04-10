import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ShuttleDatePicker.css';

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toYMD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYMD(s) {
  if (!s || s.length < 10) return null;
  const [y, m, day] = s.split('-').map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day);
}

function isSameYMD(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 42 ô: từ Chủ nhật tuần chứa ngày 1 */
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const c = new Date(start);
    c.setDate(start.getDate() + i);
    cells.push(c);
  }
  return cells;
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="shuttle-date-trigger__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @param {{ value: string, onChange: (ymd: string) => void, placeholder?: string, id?: string }} props
 */
export default function ShuttleDateField({ value, onChange, placeholder = 'dd/mm/yyyy', id }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const syncViewFromValue = useCallback(() => {
    const d = parseYMD(value);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  useEffect(() => {
    if (open) syncViewFromValue();
  }, [open, syncViewFromValue]);

  useLayoutEffect(() => {
    if (!open || !inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    const w = Math.max(r.width, 280);
    let left = r.left;
    if (left + w > window.innerWidth - 12) left = Math.max(12, window.innerWidth - w - 12);
    let top = r.bottom + 8;
    const estH = 380;
    if (top + estH > window.innerHeight - 8) top = Math.max(8, r.top - estH - 8);
    setPos({ top, left, width: w });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const t = e.target;
      if (inputRef.current?.contains(t)) return;
      if (wrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectedDate = parseYMD(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

// title removed

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const grid = buildMonthGrid(viewYear, viewMonth);
  const displayStr = value && selectedDate ? selectedDate.toLocaleDateString('vi-VN') : '';

  const panel = open && (
    <div
      ref={wrapRef}
      className="shuttle-cal"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width || 320,
      }}
      role="dialog"
      aria-label="Chọn ngày"
    >
      <div className="shuttle-cal__surface">
        <div className="shuttle-cal__header">
          <div className="shuttle-cal__nav">
            <button type="button" className="shuttle-cal__nav-btn" onClick={prevMonth} aria-label="Tháng trước">
              <ChevronLeft />
            </button>
          </div>
          <div className="shuttle-cal__title" style={{ display: 'flex', gap: '8px', justifyContent: 'center', flex: 1 }}>
            <select 
              value={viewMonth} 
              onChange={(e) => setViewMonth(Number(e.target.value))}
              style={{ border: 'none', background: 'transparent', fontWeight: 'bold', outline: 'none', appearance: 'menulist', padding: '0 4px', cursor: 'pointer', color: 'inherit' }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option style={{ color: '#000' }} key={i} value={i}>Tháng {i + 1}</option>
              ))}
            </select>
            <select 
              value={viewYear} 
              onChange={(e) => setViewYear(Number(e.target.value))}
              style={{ border: 'none', background: 'transparent', fontWeight: 'bold', outline: 'none', appearance: 'menulist', padding: '0 4px', cursor: 'pointer', color: 'inherit' }}
            >
              {Array.from({ length: 151 }).map((_, i) => {
                const y = new Date().getFullYear() - 100 + i;
                return <option style={{ color: '#000' }} key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
          <div className="shuttle-cal__nav">
            <button type="button" className="shuttle-cal__nav-btn" onClick={nextMonth} aria-label="Tháng sau">
              <ChevronRight />
            </button>
          </div>
        </div>
        <div className="shuttle-cal__dow-row">
          {DOW.map((d) => (
            <div key={d} className="shuttle-cal__dow-cell">
              {d}
            </div>
          ))}
        </div>
        <div className="shuttle-cal__grid">
          {grid.map((cell, idx) => {
            const inMonth = cell.getMonth() === viewMonth;
            const ymd = toYMD(cell);
            const isSel = value === ymd;
            const isTo = isSameYMD(cell, today);
            return (
              <button
                key={idx}
                type="button"
                className={[
                  'shuttle-cal__day',
                  !inMonth && 'shuttle-cal__day--muted',
                  isSel && 'shuttle-cal__day--selected',
                  isTo && 'shuttle-cal__day--today',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  onChange(ymd);
                  setOpen(false);
                }}
              >
                {cell.getDate()}
              </button>
            );
          })}
        </div>
        <div className="shuttle-cal__footer">
          <button
            type="button"
            className="shuttle-cal__action shuttle-cal__action--ghost"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            Xóa
          </button>
          <button
            type="button"
            className="shuttle-cal__action shuttle-cal__action--primary"
            onClick={() => {
              onChange(toYMD(new Date()));
              setOpen(false);
            }}
          >
            Hôm nay
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="shuttle-date-trigger">
      <input
        ref={inputRef}
        id={id}
        type="text"
        readOnly
        className="shuttle-date-trigger__input"
        placeholder={placeholder}
        value={displayStr}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        autoComplete="off"
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      <CalendarIcon />
      {typeof document !== 'undefined' && open && createPortal(panel, document.body)}
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));

/**
 * Chọn giờ / phút bằng lưới nút — nhanh hơn dropdown, đồng bộ theme Shuttle Up
 */
export function ShuttleTimePicker({ hourValue, minuteValue, onHourChange, onMinuteChange, minuteOptions }) {
  return (
    <div className="shuttle-time-picker">
      <div className="shuttle-time-picker__preview" aria-live="polite">
        <span className="shuttle-time-picker__preview-label">Khung giờ</span>
        <span className="shuttle-time-picker__preview-time">
          {hourValue}:{minuteValue}
        </span>
      </div>
      <div className="shuttle-time-picker__block">
        <span className="shuttle-time-picker__block-title">Giờ</span>
        <div className="shuttle-time-picker__grid-hour" role="group" aria-label="Chọn giờ">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              className={`shuttle-time-picker__chip ${hourValue === h ? 'is-active' : ''}`}
              onClick={() => onHourChange(h)}
            >
              {h}
            </button>
          ))}
        </div>
      </div>
      <div className="shuttle-time-picker__block">
        <span className="shuttle-time-picker__block-title">Phút</span>
        <div className="shuttle-time-picker__row-min" role="group" aria-label="Chọn phút">
          {minuteOptions.map((m) => (
            <button
              key={m}
              type="button"
              className={`shuttle-time-picker__chip shuttle-time-picker__chip--min ${minuteValue === m ? 'is-active' : ''}`}
              onClick={() => onMinuteChange(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
