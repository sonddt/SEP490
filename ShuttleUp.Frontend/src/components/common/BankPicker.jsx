import React, { useState, useEffect, useMemo, useRef } from 'react';
import { normalizeSearchText } from '../../utils/searchNormalize';
import { POPULAR_BANK_BINS } from '../../pages/manager/managerCheckoutSettingsShared';

const BANK_SEARCH_ALIASES = {
  TPBANK: ['tp bank', 'tien phong bank', 'tiên phong bank', 'ngan hang tien phong', 'ngân hàng tiên phong'],
  VIETCOMBANK: ['vcb', 'vietcom', 'ngoai thuong', 'ngân hàng ngoại thương'],
  VIETINBANK: ['ctg', 'cong thuong', 'công thương', 'vietin'],
  BIDV: ['dau tu va phat trien', 'đầu tư và phát triển'],
  TECHCOMBANK: ['tcb', 'ky thuong', 'kỹ thương'],
  MBBANK: ['mb', 'quan doi', 'quân đội'],
  ACB: ['a chau', 'á châu'],
  SACOMBANK: ['stb', 'sacom', 'sai gon thuong tin', 'sài gòn thương tín'],
  VPBANK: ['vp bank', 'vpb', 'viet nam thinh vuong', 'việt nam thịnh vượng'],
  HDBANK: ['hd bank', 'hdb', 'phat trien thanh pho', 'phát triển thành phố'],
  SHB: ['sai gon ha noi', 'sài gòn hà nội'],
  OCB: ['phuong dong', 'phương đông', 'orient commercial'],
  SEABANK: ['sea bank', 'seab', 'dong nam a', 'đông nam á'],
  LPBANK: ['lp bank', 'lien viet', 'liên việt', 'lienvietpostbank', 'buu dien lien viet', 'bưu điện liên việt'],
  EXIMBANK: ['exim', 'xuat nhap khau', 'xuất nhập khẩu'],
  AGRIBANK: ['agr', 'nong nghiep', 'nông nghiệp', 'nông nghiệp và phát triển nông thôn'],
  MSB: ['maritime bank', 'hang hai', 'hàng hải'],
  NAMABANK: ['nam a', 'nam á'],
  BACABANK: ['bac a', 'bắc á', 'baca', 'bacabank'],
  VIB: ['international bank', 'quoc te', 'quốc tế'],
};

function toCompactKey(text) {
  return normalizeSearchText(text || '').replace(/\s+/g, '');
}

function buildBankSearchBlob(bank) {
  const aliasByShortName = BANK_SEARCH_ALIASES[toCompactKey(bank?.shortName).toUpperCase()] || [];
  const aliasByCode = BANK_SEARCH_ALIASES[String(bank?.code || '').toUpperCase()] || [];
  const rawParts = [
    bank?.shortName,
    bank?.name,
    bank?.code,
    bank?.bin,
    ...aliasByShortName,
    ...aliasByCode,
  ]
    .filter(Boolean)
    .map((v) => String(v));

  const normalizedParts = rawParts.map((v) => normalizeSearchText(v));
  const compactParts = normalizedParts.map((v) => v.replace(/\s+/g, ''));
  return `${normalizedParts.join(' ')} ${compactParts.join(' ')}`.trim();
}

export function BankPicker({ banks, value, onSelect, error, loading }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return banks;
    const nq = normalizeSearchText(search);
    const compactQuery = nq.replace(/\s+/g, '');
    if (!nq) return banks;
    return banks.filter(
      (b) => {
        const blob = buildBankSearchBlob(b);
        return blob.includes(nq) || blob.includes(compactQuery);
      },
    );
  }, [banks, search]);

  const popular = useMemo(() => filtered.filter((b) => POPULAR_BANK_BINS.includes(b.bin)), [filtered]);
  const others = useMemo(() => filtered.filter((b) => !POPULAR_BANK_BINS.includes(b.bin)), [filtered]);

  const selected = banks.find((b) => b.shortName === value);

  const triggerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#f8fafc', borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
    border: error ? '1px solid #dc3545' : open ? '1px solid #097E52' : '1px solid #e2e8f0',
    transition: 'border-color 0.15s',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={triggerStyle} onClick={() => { if (!loading) setOpen(!open); }}>
        {loading ? (
          <span className="text-muted" style={{ fontSize: 14 }}>
            <span className="spinner-border spinner-border-sm me-2" role="status" />Đang tải danh sách…
          </span>
        ) : selected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selected.logo && (
              <img src={selected.logo} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} onError={(e) => { e.target.style.display = 'none'; }} />
            )}
            <span style={{ fontWeight: 500, color: '#1e293b' }}>{selected.shortName}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>({selected.bin})</span>
          </div>
        ) : value === 'Khác' ? (
          <span style={{ color: '#1e293b', fontWeight: 500 }}>Khác (nhập thủ công)</span>
        ) : (
          <span style={{ color: '#94a3b8' }}>-- Chọn ngân hàng --</span>
        )}
        <i className={`feather-chevron-${open ? 'up' : 'down'}`} style={{ color: '#94a3b8', fontSize: 16 }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1055,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              ref={searchRef}
              type="text"
              className="form-control form-control-sm"
              placeholder="Tìm ngân hàng…"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {popular.length > 0 && (
              <>
                <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Phổ biến
                </div>
                {popular.map((b) => (
                  <BankItem key={b.bin} bank={b} onClick={() => { onSelect(b.shortName, b.bin, b.logo); setOpen(false); setSearch(''); }} />
                ))}
              </>
            )}
            {others.length > 0 && (
              <>
                <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, borderTop: popular.length > 0 ? '1px solid #f1f5f9' : 'none' }}>
                  {search ? 'Kết quả' : 'Tất cả ngân hàng'}
                </div>
                {others.map((b) => (
                  <BankItem key={b.bin} bank={b} onClick={() => { onSelect(b.shortName, b.bin, b.logo); setOpen(false); setSearch(''); }} />
                ))}
              </>
            )}
            {popular.length === 0 && others.length === 0 && (
              <div style={{ padding: '16px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Không tìm thấy ngân hàng
              </div>
            )}
            <div
              style={{
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', borderTop: '1px solid #f1f5f9', color: '#64748b', fontSize: 14,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { onSelect('Khác', '', null); setOpen(false); setSearch(''); }}
            >
              <i className="feather-edit-3" style={{ fontSize: 16, color: '#94a3b8' }} />
              <span>Khác (nhập thủ công)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BankItem({ bank, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer', transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {bank.logo ? (
        <img src={bank.logo} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, border: '1px solid #f1f5f9' }} onError={(e) => { e.target.style.display = 'none'; }} />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: 4, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="feather-credit-card" style={{ fontSize: 14, color: '#94a3b8' }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: '#1e293b' }}>{bank.shortName}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bank.name}
        </div>
      </div>
      <span style={{ fontSize: 11, color: '#cbd5e1', fontFamily: 'monospace' }}>{bank.bin}</span>
    </div>
  );
}
