import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import matchingApi from '../../api/matchingApi';
import MatchingPeopleCountInput from '../../components/matching/MatchingPeopleCountInput';

const skillOptions = [
  { value: 'beginner', label: 'Mới chơi' },
  { value: 'intermediate', label: 'Trung bình' },
  { value: 'advanced', label: 'Khá giỏi' },
  { value: 'expert', label: 'Chuyên nghiệp' },
];

const genderOptions = [
  { value: '', label: 'Không yêu cầu' },
  { value: 'Nam', label: 'Nam' },
  { value: 'Nữ', label: 'Nữ' },
];

const expenseOptions = [
  { value: 'split_equal', label: 'Chia đều' },
  { value: 'host_pays', label: 'Bao sân (Host trả)' },
  { value: 'female_free', label: 'Nữ miễn phí' },
  { value: 'negotiable', label: 'Tùy thỏa thuận' },
];

export default function MatchingEditPost() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [postMeta, setPostMeta] = useState(null);

  const [form, setForm] = useState({
    title: '',
    requiredPlayers: 1,
    skillLevel: '',
    genderPref: '',
    expenseSharing: 'split_equal',
    playPurpose: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoadError('');
    setSubmitError('');
    try {
      const res = await matchingApi.getPostDetail(postId);
      setPostMeta(res);
      if (!res.isHost) {
        setLoadError('Bạn không phải chủ bài đăng này.');
        return;
      }
      if (res.status !== 'OPEN') {
        setLoadError('Chỉ có thể chỉnh sửa khi bài đang mở nhận người chơi (trạng thái đang mở).');
        return;
      }
      setForm({
        title: res.title || '',
        requiredPlayers: res.requiredPlayers ?? 1,
        skillLevel: res.skillLevel || '',
        genderPref: res.genderPref || '',
        expenseSharing: res.expenseSharing || 'split_equal',
        playPurpose: res.playPurpose || '',
        notes: res.notes || '',
      });
    } catch {
      setLoadError('Không tải được bài đăng.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (form.requiredPlayers < 1) {
      setSubmitError('Số người cần ít nhất là 1.');
      return;
    }
    setSubmitting(true);
    try {
      await matchingApi.updatePost(postId, {
        title: form.title || undefined,
        requiredPlayers: form.requiredPlayers,
        skillLevel: form.skillLevel || undefined,
        genderPref: form.genderPref || undefined,
        expenseSharing: form.expenseSharing || undefined,
        playPurpose: form.playPurpose || undefined,
        notes: form.notes || undefined,
      });
      navigate(`/matching/${postId}`);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="content">
        <div className="container text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                  <li className="breadcrumb-item"><Link to="/">Trang chủ</Link></li>
                  <li className="breadcrumb-item"><Link to="/matching">Tìm đồng đội</Link></li>
                  <li className="breadcrumb-item">
                    <Link to={`/matching/${postId}`}>Chi tiết bài</Link>
                  </li>
                  <li className="breadcrumb-item active">Chỉnh sửa</li>
                </ol>
              </nav>
              <h2 className="breadcrumb-title">Chỉnh sửa bài đăng 🏸</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          {loadError && (
            <div className="alert alert-warning">
              {loadError}
              <div className="mt-2">
                <Link to={`/matching/${postId}`} className="btn btn-sm btn-outline-primary">
                  Về trang chi tiết
                </Link>
              </div>
            </div>
          )}

          {postMeta?.isHost && postMeta?.status === 'OPEN' && !loadError && (
            <div className="matching-create-step">
              {submitError && <div className="alert alert-danger">{submitError}</div>}
              <div className="mb-3">
                <p className="text-muted mb-1">
                  <strong>{postMeta.venueName}</strong>
                  {postMeta.courtName ? ` — ${postMeta.courtName}` : ''}
                </p>
                {postMeta.playDate && (
                  <p className="text-muted small mb-0">
                    {String(postMeta.playDate)} · {postMeta.playStartTime ?? ''} — {postMeta.playEndTime ?? ''}
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Tiêu đề bài đăng</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    maxLength={255}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Số người cần thêm <span className="text-danger">*</span></label>
                  <MatchingPeopleCountInput
                    value={form.requiredPlayers}
                    onChange={(n) => setForm({ ...form, requiredPlayers: n })}
                    min={1}
                    max={20}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Trình độ yêu cầu</label>
                  <div className="matching-chips">
                    {skillOptions.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className={`matching-chip ${form.skillLevel === o.value ? 'active' : ''}`}
                        onClick={() => setForm({ ...form, skillLevel: form.skillLevel === o.value ? '' : o.value })}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Ưu tiên giới tính</label>
                  <div className="matching-chips">
                    {genderOptions.map((o) => (
                      <button
                        key={o.value || 'any'}
                        type="button"
                        className={`matching-chip ${form.genderPref === o.value ? 'active' : ''}`}
                        onClick={() => setForm({ ...form, genderPref: o.value })}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Hình thức chia tiền</label>
                  <select
                    className="form-select"
                    value={form.expenseSharing}
                    onChange={(e) => setForm({ ...form, expenseSharing: e.target.value })}
                  >
                    {expenseOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label">Mục đích chơi</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.playPurpose}
                    onChange={(e) => setForm({ ...form, playPurpose: e.target.value })}
                    maxLength={255}
                    placeholder="VD: tập giao, đánh kèo..."
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Ghi chú</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    maxLength={1000}
                  />
                </div>

                <div className="matching-step-actions">
                  <Link to={`/matching/${postId}`} className="btn btn-outline-secondary">
                    Hủy
                  </Link>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
