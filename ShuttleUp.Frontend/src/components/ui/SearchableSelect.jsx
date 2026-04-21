import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeSearchText } from '../../utils/searchNormalize';

/**
 * Dropdown có ô tìm kiếm (lọc theo tên), thay cho <select> dài.
 * @param {{ value: string, label: string }[]} options
 */
export default function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Chọn…',
  searchPlaceholder = 'Gõ để tìm…',
  emptyLabel = 'Không có lựa chọn',
  notFoundLabel = 'Không tìm thấy',
  disabled = false,
  className = '',
  triggerClass = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  const selectedLabel = useMemo(() => {
    const o = options.find((x) => String(x.value) === String(value));
    return o?.label ?? '';
  }, [options, value]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const nq = normalizeSearchText(query);
    if (!nq) return options;
    return options.filter((o) => normalizeSearchText(o.label || '').includes(nq));
  }, [options, query]);

  const baseBtn =
    `w-full flex items-center justify-between gap-2 border-0 bg-transparent py-2.5 px-0 text-left text-base font-medium transition-colors focus:outline-none disabled:opacity-60 disabled:pointer-events-none appearance-none ${triggerClass}`;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        className={baseBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className={selectedLabel ? 'text-slate-800' : 'text-slate-400'}>
          {selectedLabel || placeholder}
        </span>
        <i className={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-[10060] mt-1 rounded-[0.75rem] border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
          role="listbox"
        >
          <div className="border-b border-slate-100 px-2 pb-2 pt-1">
            <input
              type="search"
              autoComplete="off"
              className="form-control form-control-sm rounded-lg border-slate-200 py-2 text-sm"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                role="option"
                className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                {placeholder}
              </button>
            </li>
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">{emptyLabel}</li>
            )}
            {options.length > 0 &&
              filtered.map((o) => (
                <li key={String(o.value)}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={String(value) === String(o.value)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 ${
                      String(value) === String(o.value) ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-slate-800'
                    }`}
                    onClick={() => {
                      onChange(String(o.value));
                      setOpen(false);
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            {options.length > 0 && filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">{notFoundLabel}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
