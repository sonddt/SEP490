import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axiosClient from '../../api/axiosClient';

const emptyForm = {
  title: '',
  excerpt: '',
  body: '',
  coverImageUrl: '',
  linkUrl: '',
  isPublished: false,
  displayFrom: '',
  displayUntil: '',
  sortOrder: 0,
  venueId: '',
};

export default function AdminFeaturedPosts() {
  const [items, setItems] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
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
      displayFrom: row.displayFrom ? row.displayFrom.slice(0, 16) : '',
      displayUntil: row.displayUntil ? row.displayUntil.slice(0, 16) : '',
      sortOrder: row.sortOrder ?? 0,
      venueId: row.venueId || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const toIso = (local) => {
    if (!local) return null;
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Oops… Tiêu đề không được để trống.');
      return;
    }
    setFormError('');
    setSaving(true);
    const body = {
      title: form.title.trim(),
      excerpt: form.excerpt.trim() || null,
      body: form.body.trim() || null,
      coverImageUrl: form.coverImageUrl.trim() || null,
      linkUrl: form.linkUrl.trim() || null,
      isPublished: form.isPublished,
      displayFrom: toIso(form.displayFrom),
      displayUntil: toIso(form.displayUntil),
      sortOrder: Number(form.sortOrder) || 0,
      venueId: form.venueId ? form.venueId : null,
    };
    try {
      if (editingId) {
        await axiosClient.put(`/admin/featured-posts/${editingId}`, body);
      } else {
        await axiosClient.post('/admin/featured-posts', body);
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
      load();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  const modal = modalOpen && createPortal(
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1200 }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable" style={{ marginTop: '2rem' }}>
        <div className="modal-content" style={{ borderRadius: 14 }}>
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">{editingId ? 'Sửa bài Nổi bật' : 'Tạo bài Nổi bật'}</h5>
            <button type="button" className="btn-close" onClick={() => setModalOpen(false)} aria-label="Đóng" />
          </div>
          <form onSubmit={submit}>
            <div className="modal-body pt-2">
              {formError && <div className="alert alert-danger py-2 small mb-3">{formError}</div>}
              <div className="mb-3">
                <label className="form-label fw-semibold small">Tiêu đề *</label>
                <input className="form-control" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Mô tả ngắn</label>
                <input className="form-control" value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Nội dung</label>
                <textarea className="form-control" rows={4} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">URL ảnh bìa</label>
                  <input className="form-control" value={form.coverImageUrl} onChange={(e) => setForm((f) => ({ ...f, coverImageUrl: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Link CTA (nếu có)</label>
                  <input className="form-control" value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} />
                </div>
              </div>
              <div className="row g-3 mt-1">
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Thứ tự hiển thị</label>
                  <input type="number" className="form-control" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Hiển thị từ (UTC)</label>
                  <input type="datetime-local" className="form-control" value={form.displayFrom} onChange={(e) => setForm((f) => ({ ...f, displayFrom: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Hiển thị đến (UTC)</label>
                  <input type="datetime-local" className="form-control" value={form.displayUntil} onChange={(e) => setForm((f) => ({ ...f, displayUntil: e.target.value }))} />
                </div>
              </div>
              <div className="mb-3 mt-3">
                <label className="form-label fw-semibold small">Gắn cụm sân (tuỳ chọn)</label>
                <select className="form-select" value={form.venueId} onChange={(e) => setForm((f) => ({ ...f, venueId: e.target.value }))}>
                  <option value="">— Không gắn —</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="adm-fp-pub" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
                <label className="form-check-label fw-semibold small" htmlFor="adm-fp-pub">Xuất bản (hiện trên trang Nổi bật)</label>
              </div>
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-light" onClick={() => setModalOpen(false)}>Huỷ</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
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
          <h3 className="mb-0 fw-bold text-dark">Bài đăng Nổi bật</h3>
          <p className="text-secondary mb-0 mt-1" style={{ fontSize: 14 }}>Quảng cáo và tin tức hiển thị cho người chơi</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <i className="feather-plus me-1" /> Tạo bài mới
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : (
        <div className="table-responsive adm-card shadow-sm rounded-3">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Tiêu đề</th>
                <th>Tác giả</th>
                <th>Sân</th>
                <th>Xuất bản</th>
                <th className="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="fw-semibold">{row.title}</td>
                  <td><span className="badge bg-secondary">{row.authorRole}</span> {row.authorName}</td>
                  <td>{row.venueName || '—'}</td>
                  <td>{row.isPublished ? <span className="text-success fw-semibold">Có</span> : <span className="text-muted">Chưa</span>}</td>
                  <td className="text-end">
                    <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(row)}>Sửa</button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(row.id)}>Xoá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <p className="text-center text-muted py-4 mb-0">Chưa có bài đăng.</p>}
        </div>
      )}

      {modal}
    </div>
  );
}
