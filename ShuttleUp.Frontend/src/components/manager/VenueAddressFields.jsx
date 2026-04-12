import { useEffect, useMemo, useRef, useState } from 'react';
import { districtByCode, normalizeKey, provinceByCode } from '../../utils/vietnamDivisions';

function SearchSelect({
  label,
  required,
  placeholder,
  disabled,
  value,
  options,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => String(o.value) === String(value));
    return found?.label || '';
  }, [options, value]);

  const filtered = useMemo(() => {
    const query = normalizeKey((q || '').trim());
    if (!query) return options;
    return options.filter((o) => normalizeKey(o.label).includes(query));
  }, [options, q]);

  const showText = selectedLabel || placeholder || '-- Chọn --';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: 13 }}>
        {label}{required && <> <span className="text-danger">*</span></>}
      </label>

      <button
        type="button"
        disabled={disabled}
        className="form-control bg-light border-0 d-flex align-items-center justify-content-between"
        style={{ fontSize: 14, borderRadius: 10, padding: '12px 14px' }}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ color: selectedLabel ? '#0f172a' : '#94a3b8', textAlign: 'left' }}>
          {showText}
        </span>
        <i className={`feather-chevron-${open ? 'up' : 'down'}`} style={{ color: '#64748b' }} />
      </button>

      {open && !disabled && (
        <div
          className="shadow-sm"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 1200,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <i className="feather-search" style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8', fontSize: 14 }} />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="form-control"
                placeholder="Tìm nhanh…"
                style={{ paddingLeft: 32, borderRadius: 10, fontSize: 13 }}
                autoFocus
              />
            </div>
          </div>

          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <div className="text-muted small" style={{ padding: '12px 14px' }}>
                Không tìm thấy kết quả phù hợp.
              </div>
            ) : (
              filtered.map((o) => {
                const active = String(o.value) === String(value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(String(o.value));
                      setOpen(false);
                      setQ('');
                    }}
                    className="btn w-100 text-start"
                    style={{
                      borderRadius: 0,
                      padding: '10px 14px',
                      background: active ? '#f0fdf4' : '#fff',
                      color: active ? '#065f3f' : '#0f172a',
                      border: 'none',
                      fontSize: 13,
                    }}
                  >
                    {o.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Cascading address selector for Manager venue form.
 * Tỉnh/TP → Quận/Huyện → Phường/Xã + Số nhà, Đường (free text).
 */
export default function VenueAddressFields({
  tree,
  street,
  onStreetChange,
  provinceCode,
  districtCode,
  wardCode,
  onChangeProvince,
  onChangeDistrict,
  onChangeWard,
  disabled,
}) {
  const provinces = tree || [];
  const prov = provinceByCode(provinces, provinceCode);
  const districts = prov?.d || [];
  const dist = districtByCode(provinces, provinceCode, districtCode);
  const wards = dist?.w || [];

  return (
    <div className="row g-3">
      <div className="col-12 col-md-4">
        <SearchSelect
          label="Tỉnh / Thành phố"
          required
          placeholder={tree ? '-- Chọn tỉnh / thành phố --' : 'Đang tải…'}
          disabled={disabled || !tree}
          value={provinceCode}
          options={provinces.map((p) => ({ value: String(p.c), label: p.n }))}
          onChange={onChangeProvince}
        />
      </div>

      <div className="col-12 col-md-4">
        <SearchSelect
          label="Quận / Huyện"
          required
          placeholder="-- Chọn quận / huyện --"
          disabled={disabled || !tree || !provinceCode}
          value={districtCode}
          options={districts.map((d) => ({ value: String(d.c), label: d.n }))}
          onChange={onChangeDistrict}
        />
      </div>

      <div className="col-12 col-md-4">
        <SearchSelect
          label="Phường / Xã"
          placeholder="-- Chọn phường / xã --"
          disabled={disabled || !tree || !districtCode}
          value={wardCode}
          options={wards.map((w) => ({ value: String(w.c), label: w.n }))}
          onChange={onChangeWard}
        />
      </div>

      <div className="col-12">
        <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: 13 }}>
          Số nhà, Đường
        </label>
        <input
          type="text"
          className="form-control bg-light border-0"
          style={{ fontSize: 14 }}
          placeholder="VD: 12 Nguyễn Thị Thập"
          value={street}
          disabled={disabled}
          onChange={(e) => onStreetChange(e.target.value)}
        />
      </div>
    </div>
  );
}
