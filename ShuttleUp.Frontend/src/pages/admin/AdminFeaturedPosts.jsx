import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { notifySuccess, notifyError } from '../../hooks/useNotification';
import axiosClient from '../../api/axiosClient';
import ShuttleDateField, { ShuttleTimePicker, toYMD } from '../../components/ui/ShuttleDateField';
import { normalizedIncludesAny } from '../../utils/searchNormalize';

const EMPTY_FORM = {
  title: '',
  excerpt: '',
  body: '',
  coverImageUrl: '',
  linkUrl: '',
  isPublished: false,
  displayFrom: '',
  displayUntil: '',
  venueId: '',
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isoToLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function localToIso(local) {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCreatedLabel(iso) {
  if (!iso) return '—';
  const s = formatDate(iso);
  return s ? `Tạo ${s}` : '—';
}

const PAGE_SIZE = 8;

const FP_SORT_OPTIONS = [
  { value: 'created_desc', label: 'Mới nhất trước' },
  { value: 'created_asc', label: 'Cũ nhất trước' },
  { value: 'title_asc', label: 'Tiêu đề (A → Z)' },
  { value: 'title_desc', label: 'Tiêu đề (Z → A)' },
];

function AdminFeaturedSortDropdown({ sort, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Sắp xếp"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 14px', border: '2px solid var(--adm-accent)', borderRadius: 8,
          background: open ? 'var(--adm-accent)' : '#fff',
          color: open ? '#fff' : '#334155',
          fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
          transition: 'background .15s ease, color .15s ease, box-shadow .2s ease, transform .2s ease',
          boxShadow: open ? '0 4px 14px rgba(99,102,241,.35)' : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          if (open) {
            e.currentTarget.style.boxShadow = '0 8px 22px rgba(99,102,241,.45)';
          } else {
            e.currentTarget.style.background = 'var(--adm-accent-light)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,.22)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = open ? '0 4px 14px rgba(99,102,241,.35)' : 'none';
          e.currentTarget.style.background = open ? 'var(--adm-accent)' : '#fff';
        }}
      >
        <i className="feather-sliders" style={{ fontSize: 15 }} />
        <i className={`feather-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 14 }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 300, minWidth: 220, overflow: 'hidden',
        }}
        >
          <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Sắp xếp theo
          </div>
          {FP_SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px',
                border: 'none', background: sort === o.value ? 'var(--adm-accent-light)' : 'none',
                fontSize: 13.5, fontWeight: sort === o.value ? 700 : 400, cursor: 'pointer',
                color: sort === o.value ? 'var(--adm-accent-hover)' : '#334155', textAlign: 'left',
                transition: 'background .12s ease',
              }}
              onMouseEnter={(ev) => {
                if (sort !== o.value) ev.currentTarget.style.background = 'rgba(99,102,241,.1)';
              }}
              onMouseLeave={(ev) => {
                if (sort !== o.value) ev.currentTarget.style.background = 'none';
              }}
            >
              {sort === o.value && <i className="feather-check" style={{ fontSize: 14, color: 'var(--adm-accent)', flexShrink: 0 }} />}
              <span style={{ marginLeft: sort === o.value ? 0 : 20 }}>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminFeaturedPagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, flexWrap: 'wrap' }}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px',
          border: '2px solid var(--adm-border)', borderRadius: 8, background: '#fff', fontSize: 13,
          fontWeight: 600, color: page <= 1 ? '#cbd5e1' : '#334155', cursor: page <= 1 ? 'default' : 'pointer',
          transition: 'border-color .15s ease, box-shadow .2s ease, transform .2s ease',
        }}
        onMouseEnter={(e) => {
          if (page <= 1) return;
          e.currentTarget.style.borderColor = 'var(--adm-accent)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,.2)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--adm-border)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'none';
        }}
      >
        <i className="feather-chevron-left" style={{ fontSize: 15 }} /> Trước
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          style={{
            width: 38, height: 38, borderRadius: 8, border: 'none',
            background: page === p ? 'var(--adm-accent)' : '#f1f5f9',
            color: page === p ? '#fff' : '#334155',
            fontWeight: page === p ? 800 : 500, fontSize: 14,
            cursor: 'pointer',
            boxShadow: page === p ? '0 2px 8px rgba(99,102,241,.35)' : 'none',
            transition: 'background .15s ease, box-shadow .2s ease, transform .2s ease',
          }}
          onMouseEnter={(e) => {
            if (page === p) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(99,102,241,.45)';
            } else {
              e.currentTarget.style.background = '#e0e7ff';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.background = page === p ? 'var(--adm-accent)' : '#f1f5f9';
            e.currentTarget.style.boxShadow = page === p ? '0 2px 8px rgba(99,102,241,.35)' : 'none';
          }}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px',
          border: '2px solid var(--adm-border)', borderRadius: 8, background: '#fff', fontSize: 13,
          fontWeight: 600, color: page >= totalPages ? '#cbd5e1' : '#334155',
          cursor: page >= totalPages ? 'default' : 'pointer',
          transition: 'border-color .15s ease, box-shadow .2s ease, transform .2s ease',
        }}
        onMouseEnter={(e) => {
          if (page >= totalPages) return;
          e.currentTarget.style.borderColor = 'var(--adm-accent)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,.2)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--adm-border)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'none';
        }}
      >
        Sau <i className="feather-chevron-right" style={{ fontSize: 15 }} />
      </button>
    </div>
  );
}

function authorBadgeStyle(role) {
  const r = (role || '').toUpperCase();
  if (r === 'ADMIN') {
    return { bg: '#eef2ff', border: '#c7d2fe', color: '#3730a3' };
  }
  return { bg: '#ecfdf5', border: '#a7f3d0', color: '#065f3f' };
}

function AdminFeaturedTable({ rows, onEdit, onDelete }) {
  return (
    <div className="card border-0 overflow-hidden" style={{ borderRadius: 'var(--adm-radius)', boxShadow: 'var(--adm-shadow)' }}>
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0" style={{ fontSize: 14 }}>
          <thead className="table-light">
            <tr>
              <th className="text-nowrap" style={{ width: 72 }}>Ảnh</th>
              <th>Tiêu đề</th>
              <th className="d-none d-md-table-cell text-nowrap">Tác giả</th>
              <th className="d-none d-lg-table-cell">Sân</th>
              <th className="text-nowrap">Trạng thái</th>
              <th className="d-none d-xl-table-cell text-nowrap">Tạo lúc</th>
              <th className="text-end text-nowrap" style={{ width: 168 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ab = authorBadgeStyle(row.authorRole);
              return (
                <tr key={row.id}>
                  <td>
                    <div
                      style={{
                        width: 52, height: 52, borderRadius: 10, overflow: 'hidden',
                        background: '#f1f5f9', border: '1px solid var(--adm-border)',
                      }}
                    >
                      {row.coverImageUrl ? (
                        <img src={row.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                          <i className="feather-image" style={{ fontSize: 18, opacity: 0.45 }} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="fw-semibold text-truncate-1" style={{ color: '#1e293b', minWidth: 160 }}>{row.title}</div>
                    {row.excerpt && (
                      <div className="text-muted small mt-1 text-truncate-2" style={{ maxWidth: 360, lineHeight: 1.35 }}>
                        {row.excerpt}
                      </div>
                    )}
                    <div className="d-md-none mt-2 small">
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                          background: ab.bg, border: `1px solid ${ab.border}`, color: ab.color,
                        }}
                      >
                        [{row.authorRole}] {row.authorName || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="d-none d-md-table-cell">
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: ab.bg, border: `1px solid ${ab.border}`, color: ab.color,
                      }}
                    >
                      [{row.authorRole}] {row.authorName || '—'}
                    </span>
                  </td>
                  <td className="d-none d-lg-table-cell text-muted small">
                    {row.venueName ? (
                      <span><i className="feather-map-pin me-1" style={{ fontSize: 12 }} />{row.venueName}</span>
                    ) : '—'}
                  </td>
                  <td>
                    {row.isPublished ? (
                      <span
                        className="rounded-pill d-inline-flex align-items-center"
                        style={{
                          padding: '8px 16px',
                          fontSize: 13,
                          fontWeight: 700,
                          letterSpacing: '.01em',
                          background: 'rgba(9,126,82,.14)',
                          color: '#065f3f',
                          border: '2px solid rgba(9,126,82,.35)',
                        }}
                      >
                        Đã xuất bản
                      </span>
                    ) : (
                      <span
                        className="rounded-pill d-inline-flex align-items-center"
                        style={{
                          padding: '8px 16px',
                          fontSize: 13,
                          fontWeight: 700,
                          background: '#fffbeb',
                          color: '#92400e',
                          border: '2px solid #fcd34d',
                        }}
                      >
                        Nháp
                      </span>
                    )}
                  </td>
                  <td className="d-none d-xl-table-cell text-muted small text-nowrap">
                    {formatCreatedLabel(row.createdAt)}
                  </td>
                  <td className="text-end">
                    <div
                      className="d-inline-flex align-items-center justify-content-end gap-2"
                      style={{ verticalAlign: 'middle' }}
                    >
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          minHeight: 38,
                          padding: '0 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 8,
                          background: '#fff',
                          color: 'var(--adm-accent-hover)',
                          border: '2px solid var(--adm-accent)',
                          boxShadow: '0 1px 2px rgba(99,102,241,.12)',
                          cursor: 'pointer',
                          transition: 'background .15s ease, color .15s ease, box-shadow .2s ease, transform .2s ease, border-color .15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--adm-accent-light)';
                          e.currentTarget.style.color = 'var(--adm-accent-hover)';
                          e.currentTarget.style.borderColor = 'var(--adm-accent-hover)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,.35)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.color = 'var(--adm-accent-hover)';
                          e.currentTarget.style.borderColor = 'var(--adm-accent)';
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(99,102,241,.12)';
                        }}
                      >
                        <i className="feather-edit-3" style={{ fontSize: 15 }} /> Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(row.id)}
                        title="Xoá"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 38,
                          minWidth: 38,
                          width: 38,
                          padding: 0,
                          borderRadius: 8,
                          background: '#fff',
                          color: '#dc2626',
                          border: '2px solid #ef4444',
                          boxShadow: '0 1px 2px rgba(220,38,38,.08)',
                          cursor: 'pointer',
                          transition: 'background .15s ease, border-color .15s ease, box-shadow .2s ease, transform .2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fef2f2';
                          e.currentTarget.style.borderColor = '#dc2626';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(220,38,38,.28)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.borderColor = '#ef4444';
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(220,38,38,.08)';
                        }}
                      >
                        <i className="feather-trash-2" style={{ fontSize: 16 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminFeaturedPostCard({ row, onEdit, onDelete }) {
  const ab = authorBadgeStyle(row.authorRole);
  const fromStr = row.displayFrom ? formatDate(row.displayFrom) : null;
  const untilStr = row.displayUntil ? formatDate(row.displayUntil) : null;
  const hasDateLimit = row.displayFrom || row.displayUntil;

  return (
    <div
      className="h-100 d-flex flex-column border-0"
      style={{
        borderRadius: 'var(--adm-radius)',
        boxShadow: 'var(--adm-shadow)',
        background: '#fff',
        overflow: 'hidden',
        border: '1px solid var(--adm-border)',
      }}
    >
      <div style={{ position: 'relative', height: 160, background: '#f1f5f9' }}>
        {row.coverImageUrl ? (
          <img src={row.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 text-muted">
            <i className="feather-image" style={{ fontSize: 40, opacity: 0.35 }} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          {row.isPublished ? (
            <span
              className="rounded-pill"
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '.02em',
                background: 'rgba(9,126,82,.92)', color: '#fff', border: '1px solid rgba(255,255,255,.35)',
              }}
            >
              Đã xuất bản
            </span>
          ) : (
            <span
              className="rounded-pill"
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 800,
                background: 'rgba(255,251,235,.95)', color: '#92400e', border: '1px solid #fcd34d',
              }}
            >
              Nháp
            </span>
          )}
        </div>
      </div>

      <div className="flex-grow-1 d-flex flex-column p-3" style={{ gap: 10 }}>
        <div>
          <h6 className="fw-bold mb-2 text-truncate-2" style={{ fontSize: 15, color: '#1e293b', lineHeight: 1.35, minHeight: 40 }}>
            {row.title}
          </h6>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: ab.bg, border: `1px solid ${ab.border}`, color: ab.color,
            }}
          >
            [{row.authorRole}] {row.authorName || '—'}
          </span>
        </div>

        {row.excerpt && (
          <p className="small text-muted mb-0 text-truncate-2" style={{ lineHeight: 1.45, minHeight: 36 }}>{row.excerpt}</p>
        )}

        {row.venueName && (
          <div>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6,
                background: 'var(--adm-accent-light)', border: '1px solid rgba(99,102,241,.25)',
                fontSize: 12, fontWeight: 600, color: 'var(--adm-accent-hover)',
              }}
            >
              <i className="feather-map-pin" style={{ fontSize: 11 }} />{row.venueName}
            </span>
          </div>
        )}

        {hasDateLimit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            <i className="feather-calendar" style={{ fontSize: 12 }} />
            <span>{fromStr || 'Không giới hạn'}</span>
            <span style={{ color: '#cbd5e1' }}>→</span>
            <span>{untilStr || 'Không giới hạn'}</span>
          </div>
        )}

        <div className="text-muted small mt-auto">{formatCreatedLabel(row.createdAt)}</div>
      </div>

      <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--adm-border)', display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => onEdit(row)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '10px 0', borderRadius: 9, border: '2px solid var(--adm-accent)',
            background: '#fff', color: 'var(--adm-accent-hover)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(99,102,241,.12)',
            transition: 'background .15s ease, border-color .15s ease, box-shadow .2s ease, transform .2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--adm-accent-light)';
            e.currentTarget.style.borderColor = 'var(--adm-accent-hover)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.borderColor = 'var(--adm-accent)';
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(99,102,241,.12)';
          }}
        >
          <i className="feather-edit-3" style={{ fontSize: 15 }} />Sửa bài
        </button>
        <button
          type="button"
          onClick={() => onDelete(row.id)}
          title="Xoá"
          style={{
            width: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 9, border: '2px solid #ef4444', background: '#fff', color: '#dc2626',
            fontSize: 15, cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 2px rgba(220,38,38,.08)',
            transition: 'background .15s ease, border-color .15s ease, box-shadow .2s ease, transform .2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fef2f2';
            e.currentTarget.style.borderColor = '#dc2626';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(220,38,38,.28)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.borderColor = '#ef4444';
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(220,38,38,.08)';
          }}
        >
          <i className="feather-trash-2" style={{ fontSize: 16 }} />
        </button>
      </div>
    </div>
  );
}

export default function AdminFeaturedPosts() {
  const [items, setItems] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sort, setSort] = useState('created_desc');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('table');

  const filteredSorted = useMemo(() => {
    let arr = items.filter((row) => {
      const pub = !!row.isPublished;
      const matchStatus = filterStatus === 'all'
        || (filterStatus === 'published' && pub)
        || (filterStatus === 'draft' && !pub);
      if (!matchStatus) return false;
      return normalizedIncludesAny(search, [
        row.title,
        row.excerpt,
        row.body,
        row.venueName,
        row.authorName,
        row.authorRole,
      ]);
    });
    switch (sort) {
      case 'created_asc':
        return [...arr].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      case 'title_asc':
        return [...arr].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi'));
      case 'title_desc':
        return [...arr].sort((a, b) => (b.title || '').localeCompare(a.title || '', 'vi'));
      default:
        return [...arr].sort((a, b) => {
          const d = new Date(b.createdAt) - new Date(a.createdAt);
          if (d !== 0) return d;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });
    }
  }, [items, search, filterStatus, sort]);

  const paginated = useMemo(
    () => filteredSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredSorted, page],
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [filteredSorted.length, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [posts, vList] = await Promise.all([
        axiosClient.get('/admin/featured-posts'),
        axiosClient.get('/venues'),
      ]);
      setItems(Array.isArray(posts) ? posts : []);
      setVenues(Array.isArray(vList) ? vList : []);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearchChange = (e) => { setSearch(e.target.value); setPage(1); };
  const handleFilterChange = (e) => { setFilterStatus(e.target.value); setPage(1); };
  const handleSortChange = (v) => { setSort(v); setPage(1); };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImagePreview('');
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      title: row.title || '',
      excerpt: row.excerpt || '',
      body: row.body || '',
      coverImageUrl: row.coverImageUrl || '',
      linkUrl: row.linkUrl || '',
      isPublished: !!row.isPublished,
      displayFrom: isoToLocal(row.displayFrom),
      displayUntil: isoToLocal(row.displayUntil),
      venueId: row.venueId || '',
    });
    setImagePreview(row.coverImageUrl || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFormError('Oops… Vui lòng chọn file ảnh (jpg, png, webp…).'); return; }
    if (file.size > 5 * 1024 * 1024) { setFormError('Oops… Ảnh không được vượt quá 5 MB.'); return; }
    setFormError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axiosClient.post('/admin/featured-posts/upload-image', fd);
      const url = res?.url || res?.data?.url || res;
      setField('coverImageUrl', url);
      setImagePreview(url);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Upload ảnh thất bại. Thử lại nhé!');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('Oops… Tiêu đề không được để trống.'); return; }
    setFormError('');
    setSaving(true);
    const body = {
      title: form.title.trim(),
      excerpt: form.excerpt.trim() || null,
      body: form.body.trim() || null,
      coverImageUrl: form.coverImageUrl.trim() || null,
      linkUrl: form.linkUrl.trim() || null,
      isPublished: form.isPublished,
      displayFrom: localToIso(form.displayFrom),
      displayUntil: localToIso(form.displayUntil),
      venueId: form.venueId || null,
    };
    try {
      if (editingId) {
        await axiosClient.put(`/admin/featured-posts/${editingId}`, body);
        notifySuccess('Đã cập nhật bài đăng!');
      } else {
        await axiosClient.post('/admin/featured-posts', body);
        notifySuccess('Đã tạo bài đăng mới!');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Lưu thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Xoá bài đăng này?')) return;
    try {
      await axiosClient.delete(`/admin/featured-posts/${id}`);
      notifySuccess('Đã xoá bài đăng.');
      load();
    } catch (e) {
      notifyError(e.response?.data?.message || e.message);
    }
  };

  const rangeStart = filteredSorted.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredSorted.length);

  const modal = modalOpen && createPortal(
    <div
      className="modal"
      style={{
        display: 'block',
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1200,
        overflowY: 'auto',
        padding: '1.75rem 0.5rem',
        height: '100%',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="adm-fp-modal-title"
      onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
    >
      <div className="modal-dialog modal-lg" style={{ margin: '0 auto', maxWidth: 800 }}>
        <div className="modal-content rounded-4 border-0 shadow-lg">

          {/* Header */}
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <div className="d-flex align-items-center gap-3">
              <div className="d-flex align-items-center justify-content-center rounded-3"
                style={{ width: 44, height: 44, background: 'rgba(99,102,241,.12)', flexShrink: 0 }}>
                <i className="feather-star" style={{ fontSize: 20, color: 'var(--adm-accent)' }} />
              </div>
              <div>
                <h4 id="adm-fp-modal-title" className="modal-title fw-bold mb-1"
                  style={{ fontSize: 17, color: '#1e293b' }}>
                  {editingId ? 'Sửa bài Nổi bật' : 'Tạo bài Nổi bật'}
                </h4>
                <p className="mb-0" style={{ fontSize: 13, color: '#64748b' }}>
                  Bài sẽ hiển thị khi đã bật xuất bản và trong khung thời gian hợp lệ.
                </p>
              </div>
            </div>
            <button type="button" className="btn-close" onClick={() => setModalOpen(false)} aria-label="Đóng" />
          </div>

          <form onSubmit={submit}>
            <div className="modal-body p-4 p-md-5 pt-4">
              {formError && (
                <div className="alert alert-danger d-flex align-items-start gap-2 mb-4 rounded-3" role="alert">
                  <i className="feather-alert-circle mt-1 flex-shrink-0" />
                  <div><strong>Oops:</strong> {formError}</div>
                  <button type="button" className="btn-close ms-auto" onClick={() => setFormError('')} />
                </div>
              )}

              {/* Nội dung chính */}
              <div className="mb-4">
                <h6 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 14 }}>
                  <i className="feather-edit-3 me-2" />Nội dung bài đăng
                </h6>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: '#475569' }}>
                      Tiêu đề <span className="text-danger">*</span>
                    </label>
                    <input className="form-control bg-light border-0" style={{ fontSize: 14 }}
                      placeholder="VD: Ưu đãi đặc biệt tháng 4"
                      value={form.title} onChange={e => setField('title', e.target.value)} required />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: '#475569' }}>Mô tả ngắn</label>
                    <input className="form-control bg-light border-0" style={{ fontSize: 14 }}
                      placeholder="Tóm tắt hiển thị dưới tiêu đề"
                      value={form.excerpt} onChange={e => setField('excerpt', e.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: '#475569' }}>Nội dung chi tiết</label>
                    <textarea className="form-control bg-light border-0" style={{ fontSize: 14, resize: 'vertical' }}
                      rows={3} placeholder="Nội dung đầy đủ, hướng dẫn, điều kiện..."
                      value={form.body} onChange={e => setField('body', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Ảnh bìa */}
              <div className="mb-4 border-top pt-4">
                <h6 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 14 }}>
                  <i className="feather-image me-2" />Ảnh bìa
                </h6>
                <div className="d-flex align-items-start gap-3 flex-wrap">
                  <div style={{
                    width: 160, height: 96, borderRadius: 10, border: '2px dashed var(--adm-border)',
                    background: '#f8fafc', overflow: 'hidden', flexShrink: 0, position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Ảnh bìa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" onClick={() => { setImagePreview(''); setField('coverImageUrl', ''); }}
                          style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, transition: 'background .15s ease, transform .2s ease' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,.85)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,.55)'; e.currentTarget.style.transform = 'none'; }}
                          title="Xoá ảnh"><i className="feather-x" /></button>
                      </>
                    ) : (
                      <i className="feather-image" style={{ fontSize: 28, color: 'var(--adm-border)' }} />
                    )}
                    {uploading && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="spinner-border spinner-border-sm" style={{ color: 'var(--adm-accent)' }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow-1" style={{ minWidth: 180 }}>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />
                    <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--adm-accent)', background: '#fff', color: 'var(--adm-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8, transition: 'background .15s ease, color .15s ease, box-shadow .2s ease, transform .2s ease' }}
                      onMouseEnter={(e) => {
                        if (uploading) return;
                        e.currentTarget.style.background = 'var(--adm-accent)';
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,.35)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.color = 'var(--adm-accent)';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}>
                      <i className="feather-upload" style={{ fontSize: 14 }} />
                      {uploading ? 'Đang tải lên…' : 'Chọn ảnh từ máy'}
                    </button>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 8px' }}>JPG, PNG, WEBP — tối đa 5 MB. Tỷ lệ đề xuất 16:9.</p>
                    <label className="form-label fw-semibold" style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Hoặc dán URL ảnh</label>
                    <input type="url" className="form-control bg-light border-0" style={{ fontSize: 13 }}
                      placeholder="https://..."
                      value={form.coverImageUrl}
                      onChange={e => { setField('coverImageUrl', e.target.value); setImagePreview(e.target.value); }} />
                  </div>
                </div>
              </div>

              {/* Link & Sân */}
              <div className="mb-4 border-top pt-4">
                <h6 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 14 }}>
                  <i className="feather-link me-2" />Liên kết & Gắn sân
                </h6>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: '#475569' }}>Link CTA</label>
                    <input type="text" className="form-control bg-light border-0" style={{ fontSize: 14 }}
                      placeholder="/venue-details/... hoặc /venues"
                      value={form.linkUrl} onChange={e => setField('linkUrl', e.target.value)} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: '#475569' }}>Gắn cụm sân (tuỳ chọn)</label>
                    <select className="form-select bg-light border-0" style={{ fontSize: 14 }}
                      value={form.venueId} onChange={e => setField('venueId', e.target.value)}>
                      <option value="">— Không gắn —</option>
                      {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Thời gian */}
              <div className="mb-4 border-top pt-4">
                <h6 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                  <i className="feather-clock me-2" />Thời gian hiển thị
                </h6>
                <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>Để trống để không giới hạn thời gian.</p>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: '#475569' }}>Hiển thị từ</label>
                    <ShuttleDateField
                      value={form.displayFrom ? form.displayFrom.substring(0, 10) : ''}
                      onChange={(ymd) => {
                        const time = form.displayFrom.length > 10 ? form.displayFrom.substring(10) : 'T00:00';
                        setField('displayFrom', (ymd || '') + (ymd ? time : ''));
                      }}
                      placeholder="dd/mm/yyyy"
                    />
                    <ShuttleTimePicker
                      hourValue={form.displayFrom ? (form.displayFrom.substring(11, 13) || '00') : '00'}
                      minuteValue={form.displayFrom ? (form.displayFrom.substring(14, 16) || '00') : '00'}
                      onHourChange={(h) => {
                        let dp = form.displayFrom.substring(0, 10) || '';
                        if (!dp) dp = toYMD(new Date());
                        setField('displayFrom', dp + 'T' + h + ':' + (form.displayFrom.substring(14, 16) || '00'));
                      }}
                      onMinuteChange={(m) => {
                        let dp = form.displayFrom.substring(0, 10) || '';
                        if (!dp) dp = toYMD(new Date());
                        setField('displayFrom', dp + 'T' + (form.displayFrom.substring(11, 13) || '00') + ':' + m);
                      }}
                      minuteOptions={['00', '15', '30', '45']}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: '#475569' }}>Hiển thị đến</label>
                    <ShuttleDateField
                      value={form.displayUntil ? form.displayUntil.substring(0, 10) : ''}
                      onChange={(ymd) => {
                        const time = form.displayUntil.length > 10 ? form.displayUntil.substring(10) : 'T23:59';
                        setField('displayUntil', (ymd || '') + (ymd ? time : ''));
                      }}
                      placeholder="dd/mm/yyyy"
                    />
                    <ShuttleTimePicker
                      hourValue={form.displayUntil ? (form.displayUntil.substring(11, 13) || '23') : '23'}
                      minuteValue={form.displayUntil ? (form.displayUntil.substring(14, 16) || '59') : '59'}
                      onHourChange={(h) => {
                        let dp = form.displayUntil.substring(0, 10) || '';
                        if (!dp) dp = toYMD(new Date());
                        setField('displayUntil', dp + 'T' + h + ':' + (form.displayUntil.substring(14, 16) || '59'));
                      }}
                      onMinuteChange={(m) => {
                        let dp = form.displayUntil.substring(0, 10) || '';
                        if (!dp) dp = toYMD(new Date());
                        setField('displayUntil', dp + 'T' + (form.displayUntil.substring(11, 13) || '23') + ':' + m);
                      }}
                      minuteOptions={['00', '15', '30', '45', '59']}
                    />
                  </div>
                </div>
              </div>

              {/* Phát sóng */}
              <div className="border-top pt-4">
                <h6 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 14 }}>
                  <i className="feather-settings me-2" />Cấu hình phát sóng
                </h6>
                <div className="form-check rounded-3 px-3 py-3 w-100" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <input className="form-check-input" type="checkbox" id="adm-fp-pub"
                    checked={form.isPublished} onChange={e => setField('isPublished', e.target.checked)} />
                  <label className="form-check-label fw-semibold" htmlFor="adm-fp-pub" style={{ fontSize: 13, color: '#334155' }}>
                    Xuất bản ngay
                  </label>
                  <p className="mb-0 mt-1" style={{ paddingLeft: '1.5rem', fontSize: 12, color: '#94a3b8' }}>
                    Bật để bài hiển thị công khai trong thời gian đã chọn. Trên trang Nổi bật, bài mới tạo sẽ hiển thị trước.
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer border-top-0 pt-0 pb-4 px-4 px-md-5 d-flex gap-3">
              <button type="button" className="btn btn-light fw-bold px-4 py-2" onClick={() => setModalOpen(false)}
                style={{ transition: 'background .15s ease, transform .2s ease, box-shadow .2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >Huỷ</button>
              <button type="submit" disabled={saving || uploading}
                className="btn fw-bold px-5 py-2 shadow-sm"
                style={{ background: 'var(--adm-accent)', borderColor: 'var(--adm-accent)', color: '#fff', transition: 'background .15s ease, border-color .15s ease, transform .2s ease, box-shadow .2s ease' }}
                onMouseEnter={(e) => {
                  if (saving || uploading) return;
                  e.currentTarget.style.background = 'var(--adm-accent-hover)';
                  e.currentTarget.style.borderColor = 'var(--adm-accent-hover)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 22px rgba(99,102,241,.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--adm-accent)';
                  e.currentTarget.style.borderColor = 'var(--adm-accent)';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '';
                }}>
                {saving ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Tạo bài đăng'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="container-fluid px-0 px-md-3 pb-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h3 className="mb-0 fw-bold" style={{ fontSize: 20, color: '#1e293b', letterSpacing: '-.02em' }}>
            Bài đăng Nổi bật
          </h3>
          <p className="mb-0 mt-1" style={{ fontSize: 13, color: '#64748b' }}>
            Quảng cáo và tin tức hiển thị cho người chơi
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary d-inline-flex align-items-center gap-2"
          onClick={openCreate}
          style={{ transition: 'transform .2s ease, box-shadow .2s ease' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <i className="feather-plus" style={{ fontSize: 16 }} /> Tạo bài mới
        </button>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 rounded-3">
          <i className="feather-alert-circle" />{error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Đang tải…</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-4 d-flex flex-column align-items-center justify-content-center py-5"
          style={{
            border: '2px dashed rgba(99,102,241,.35)',
            background: 'var(--adm-accent-light)',
            minHeight: 280,
          }}
        >
          <div
            className="d-flex align-items-center justify-content-center rounded-circle mb-3"
            style={{ width: 72, height: 72, background: '#fff', border: '1px solid rgba(99,102,241,.2)' }}
          >
            <i className="feather-star" style={{ fontSize: 32, color: 'var(--adm-accent)', opacity: 0.85 }} />
          </div>
          <h6 className="fw-bold mb-2" style={{ color: '#1e293b' }}>Chưa có bài đăng nào</h6>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
            Tạo bài để hiển thị trên trang Nổi bật cho người chơi.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
            style={{ transition: 'transform .2s ease, box-shadow .2s ease' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <i className="feather-plus me-1" />Tạo bài đầu tiên
          </button>
        </div>
      ) : (
        <>
          <div className="card border-0 mb-4" style={{ borderRadius: 'var(--adm-radius)', boxShadow: 'var(--adm-shadow)' }}>
            <div className="card-body py-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
                  <div className="bk-search-wrap" style={{ flex: '1 1 260px', maxWidth: 420, minWidth: 200 }}>
                    <i className="feather-search bk-search-icon" />
                    <input
                      type="text"
                      className="form-control bk-search-input"
                      placeholder="Tìm kiếm bài đăng (tiêu đề, mô tả, tác giả, sân)…"
                      value={search}
                      onChange={handleSearchChange}
                    />
                    {search && (
                      <button type="button" className="bk-search-clear" onClick={() => { setSearch(''); setPage(1); }}>
                        <i className="feather-x" />
                      </button>
                    )}
                  </div>

                  <select
                    className="form-select"
                    style={{ width: 200, flex: '0 0 auto' }}
                    value={filterStatus}
                    onChange={handleFilterChange}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="published">Đã xuất bản</option>
                    <option value="draft">Nháp</option>
                  </select>

                  <AdminFeaturedSortDropdown sort={sort} onChange={handleSortChange} />

                  {(search || filterStatus !== 'all') && (
                    <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {filteredSorted.length} kết quả
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                  <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap', marginRight: 4 }}>Hiển thị</span>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    title="Dạng bảng"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 36, height: 36, borderRadius: 8, border: '2px solid',
                      borderColor: viewMode === 'table' ? 'var(--adm-accent)' : '#e2e8f0',
                      background: viewMode === 'table' ? 'var(--adm-accent)' : '#fff',
                      color: viewMode === 'table' ? '#fff' : '#64748b',
                      cursor: 'pointer',
                      transition: 'background .15s ease, border-color .15s ease, color .15s ease, box-shadow .2s ease, transform .2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      if (viewMode === 'table') {
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(99,102,241,.45)';
                      } else {
                        e.currentTarget.style.borderColor = 'var(--adm-accent)';
                        e.currentTarget.style.background = 'var(--adm-accent-light)';
                        e.currentTarget.style.color = 'var(--adm-accent-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = viewMode === 'table' ? 'var(--adm-accent)' : '#e2e8f0';
                      e.currentTarget.style.background = viewMode === 'table' ? 'var(--adm-accent)' : '#fff';
                      e.currentTarget.style.color = viewMode === 'table' ? '#fff' : '#64748b';
                    }}
                  >
                    <i className="feather-list" style={{ fontSize: 16 }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    title="Dạng lưới"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 36, height: 36, borderRadius: 8, border: '2px solid',
                      borderColor: viewMode === 'grid' ? 'var(--adm-accent)' : '#e2e8f0',
                      background: viewMode === 'grid' ? 'var(--adm-accent)' : '#fff',
                      color: viewMode === 'grid' ? '#fff' : '#64748b',
                      cursor: 'pointer',
                      transition: 'background .15s ease, border-color .15s ease, color .15s ease, box-shadow .2s ease, transform .2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      if (viewMode === 'grid') {
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(99,102,241,.45)';
                      } else {
                        e.currentTarget.style.borderColor = 'var(--adm-accent)';
                        e.currentTarget.style.background = 'var(--adm-accent-light)';
                        e.currentTarget.style.color = 'var(--adm-accent-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = viewMode === 'grid' ? 'var(--adm-accent)' : '#e2e8f0';
                      e.currentTarget.style.background = viewMode === 'grid' ? 'var(--adm-accent)' : '#fff';
                      e.currentTarget.style.color = viewMode === 'grid' ? '#fff' : '#64748b';
                    }}
                  >
                    <i className="feather-grid" style={{ fontSize: 16 }} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {filteredSorted.length === 0 ? (
            <div className="card border-0" style={{ borderRadius: 'var(--adm-radius)', boxShadow: 'var(--adm-shadow)' }}>
              <div className="card-body text-center py-5">
                <i className="feather-search" style={{ fontSize: 36, color: '#cbd5e1' }} />
                <h6 className="fw-bold mt-3 mb-1" style={{ color: '#334155' }}>Không tìm thấy bài đăng</h6>
                <p className="text-muted small mb-0">Thử bỏ bộ lọc hoặc từ khoá tìm kiếm.</p>
              </div>
            </div>
          ) : viewMode === 'table' ? (
            <>
              <AdminFeaturedTable rows={paginated} onEdit={openEdit} onDelete={remove} />
              <div className="text-center text-muted small mt-2">
                Hiển thị {rangeStart}–{rangeEnd} trong {filteredSorted.length} bài
              </div>
              <AdminFeaturedPagination page={page} total={filteredSorted.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          ) : (
            <>
              <div className="row g-4">
                {paginated.map((row) => (
                  <div key={row.id} className="col-12 col-md-6 col-xl-4">
                    <AdminFeaturedPostCard row={row} onEdit={openEdit} onDelete={remove} />
                  </div>
                ))}
              </div>
              <div className="text-center text-muted small mt-2">
                Hiển thị {rangeStart}–{rangeEnd} trong {filteredSorted.length} bài
              </div>
              <AdminFeaturedPagination page={page} total={filteredSorted.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          )}
        </>
      )}

      {modal}
    </div>
  );
}
