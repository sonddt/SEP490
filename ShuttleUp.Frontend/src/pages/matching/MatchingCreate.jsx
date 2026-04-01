import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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

export default function MatchingCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preBookingId = searchParams.get('bookingId');

  const [step, setStep] = useState(preBookingId ? 2 : 1);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    requiredPlayers: 1,
    skillLevel: '',
    genderPref: '',
    expenseSharing: 'split_equal',
    playPurpose: '',
    notes: '',
  });

  // Load upcoming bookings
  useEffect(() => {
    (async () => {
      try {
        const res = await matchingApi.getUpcomingBookings();
        const list = Array.isArray(res) ? res : [];
        setBookings(list);

        // Auto-select if coming from booking complete page
        if (preBookingId) {
          const found = list.find((b) => b.id === preBookingId);
          if (found) {
            setSelectedBooking(found);
            setSelectedItemIds(found.items?.map((i) => i.id) || []);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [preBookingId]);

  const handleSelectBooking = (booking) => {
    setSelectedBooking(booking);
    setSelectedItemIds(booking.items?.map((i) => i.id) || []);
    setStep(2);
  };

  const toggleItem = (itemId) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleAllItems = () => {
    const allIds = selectedBooking?.items?.map((i) => i.id) || [];
    if (selectedItemIds.length === allIds.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(allIds);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!selectedBooking) { setError('Vui lòng chọn đơn đặt sân.'); return; }
    if (selectedItemIds.length === 0) { setError('Vui lòng chọn ít nhất 1 ca chơi.'); return; }
    if (form.requiredPlayers < 1) { setError('Số người cần ít nhất là 1.'); return; }

    setSubmitting(true);
    try {
      const res = await matchingApi.createPost({
        bookingId: selectedBooking.id,
        bookingItemIds: selectedItemIds,
        title: form.title || undefined,
        requiredPlayers: form.requiredPlayers,
        skillLevel: form.skillLevel || undefined,
        genderPref: form.genderPref || undefined,
        expenseSharing: form.expenseSharing || undefined,
        playPurpose: form.playPurpose || undefined,
        notes: form.notes || undefined,
      });
      navigate(`/matching/${res.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatPrice = (v) => {
    if (v == null) return '0đ';
    return Number(v).toLocaleString('vi-VN') + 'đ';
  };

  const selectedItems = selectedBooking?.items?.filter((i) => selectedItemIds.includes(i.id)) || [];
  const totalPrice = selectedItems.reduce((sum, i) => sum + (i.price || 0), 0);
  const pricePerPerson = form.requiredPlayers > 0 ? Math.round(totalPrice / (form.requiredPlayers + 1)) : totalPrice;

  return (
    <>
      {/* ── Breadcrumb ── */}
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                  <li className="breadcrumb-item"><Link to="/">Trang chủ</Link></li>
                  <li className="breadcrumb-item"><Link to="/matching">Tìm đồng đội</Link></li>
                  <li className="breadcrumb-item active">Tạo bài đăng</li>
                </ol>
              </nav>
              <h2 className="breadcrumb-title">Tạo bài tuyển đồng đội 🏸</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          {/* ── Stepper ── */}
          <div className="matching-stepper">
            {['Chọn đơn sân', 'Chọn ca chơi', 'Thông tin bài đăng', 'Xác nhận'].map((label, i) => (
              <div key={i} className={`matching-step ${step > i + 1 ? 'done' : ''} ${step === i + 1 ? 'active' : ''}`}>
                <div className="matching-step-num">{step > i + 1 ? '✓' : i + 1}</div>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" />
            </div>
          ) : (
            <>
              {/* ═══ STEP 1 — Chọn Booking ═══ */}
              {step === 1 && (
                <div className="matching-create-step">
                  <h4>Chọn đơn đặt sân sắp tới</h4>
                  {bookings.length === 0 ? (
                    <div className="matching-empty-state">
                      <div className="matching-empty-icon">📅</div>
                      <h3>Bạn chưa có đơn đặt sân nào</h3>
                      <p>Hãy đặt sân trước rồi quay lại tạo bài tìm đồng đội nhé!</p>
                      <Link to="/venues" className="btn btn-primary">Tìm sân ngay</Link>
                    </div>
                  ) : (
                    <div className="row">
                      {bookings.map((b) => {
                        const firstItem = b.items?.[0];
                        const dateStr = firstItem ? formatDate(firstItem.startTime) : '';
                        return (
                          <div key={b.id} className="col-lg-6 col-md-12 mb-3">
                            <div
                              className={`matching-booking-card ${selectedBooking?.id === b.id ? 'selected' : ''}`}
                              onClick={() => handleSelectBooking(b)}
                            >
                              <div className="matching-booking-card-header mb-2">
                                <h5><i className="feather-home me-2 text-primary"></i>{b.venueName}</h5>
                                <span className="badge bg-primary rounded-pill px-3 py-2">
                                    <i className="feather-layers me-1"></i> {b.items?.length || 0} ca
                                </span>
                              </div>
                              
                              <div className="d-flex align-items-start mb-2 text-muted">
                                <i className="feather-map-pin me-2 mt-1"></i>
                                <span>{b.venueAddress}</span>
                              </div>
                              
                              <div className="d-flex align-items-center mb-3 pb-2 border-bottom">
                                <i className="feather-calendar me-2 text-secondary"></i>
                                <span className="fw-medium text-dark">{dateStr}</span>
                                <span className="mx-2 text-muted">|</span>
                                <i className="feather-credit-card me-2 text-success"></i>
                                <span className="fw-bold text-success">{formatPrice(b.finalAmount)}</span>
                              </div>

                              <div className="matching-booking-items-wrapper">
                                {b.items?.slice(0, 3).map((item) => (
                                  <div key={item.id} className="matching-booking-item-preview d-flex justify-content-between align-items-center py-1">
                                    <span className="fw-medium text-dark"><i className="feather-check-circle text-primary me-2" style={{ fontSize: '14px' }}></i>{item.courtName}</span>
                                    <span className="text-muted small"><i className="feather-clock me-1"></i> {formatTime(item.startTime)} - {formatTime(item.endTime)}</span>
                                  </div>
                                ))}
                                {(b.items?.length || 0) > 3 && (
                                    <div className="text-center mt-2 p-1 bg-light rounded text-muted small">
                                        <i className="feather-more-horizontal"></i> ...và {b.items.length - 3} ca khác
                                    </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ STEP 2 — Chọn Ca Chơi ═══ */}
              {step === 2 && selectedBooking && (
                <div className="matching-create-step">
                  <h4>Chọn ca chơi muốn tìm đồng đội</h4>
                  <p className="text-muted">{selectedBooking.venueName} — {selectedBooking.venueAddress}</p>

                  <div className="mb-3">
                    <button className="btn btn-sm btn-outline-primary" onClick={toggleAllItems}>
                      {selectedItemIds.length === (selectedBooking.items?.length || 0) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>

                  <div className="matching-items-list mt-3">
                    {selectedBooking.items?.map((item) => {
                      const isSelected = selectedItemIds.includes(item.id);
                      return (
                        <label key={item.id} className={`matching-item-card d-flex align-items-center p-3 mb-2 border rounded ${isSelected ? 'selected border-primary' : ''}`} style={{ cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}>
                          {isSelected && <div className="position-absolute top-0 start-0 h-100 bg-primary" style={{ width: '4px' }}></div>}
                          
                          <div className="me-3">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              style={{ width: '1.2em', height: '1.2em', cursor: 'pointer' }}
                              checked={isSelected}
                              onChange={() => toggleItem(item.id)}
                            />
                          </div>

                          <div className="matching-item-info flex-grow-1" style={{ paddingTop: '5px' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <strong className="d-flex align-items-center fs-6 text-dark">
                                <i className="feather-layers text-primary me-2"></i> 
                                {item.courtName}
                              </strong>
                              <span className="badge bg-success bg-opacity-10 text-success border border-success px-2 py-1">
                                <i className="feather-tag me-1"></i> {formatPrice(item.price)}
                              </span>
                            </div>
                            
                            <div className="d-flex align-items-center text-muted small mt-2 pb-1">
                              <span className="me-4 d-flex align-items-center"><i className="feather-calendar me-1"></i> {formatDate(item.startTime)}</span>
                              <span className="d-flex align-items-center"><i className="feather-clock me-1 text-secondary"></i> <span className="fw-medium text-dark">{formatTime(item.startTime)} - {formatTime(item.endTime)}</span></span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {selectedItemIds.length > 0 && (
                    <div className="matching-items-summary d-flex justify-content-between align-items-center p-3 bg-white border border-primary rounded mt-3 shadow-sm">
                      <div className="d-flex align-items-center">
                        <div className="bg-primary bg-opacity-10 p-2 rounded me-3 text-primary d-flex align-items-center justify-content-center">
                          <i className="feather-check-square fs-5"></i>
                        </div>
                        <div>
                          <span className="text-muted d-block small">Đã chọn</span>
                          <strong className="fs-5">{selectedItemIds.length} ca chơi</strong>
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="text-muted d-block small">Tổng giá trị</span>
                        <strong className="fs-5 text-success">{formatPrice(totalPrice)}</strong>
                      </div>
                    </div>
                  )}

                  <div className="matching-step-actions">
                    <button className="btn btn-outline-secondary" onClick={() => setStep(1)}>← Quay lại</button>
                    <button
                      className="btn btn-primary"
                      disabled={selectedItemIds.length === 0}
                      onClick={() => setStep(3)}
                    >
                      Tiếp tục →
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ STEP 3 — Form thông tin ═══ */}
              {step === 3 && (
                <div className="matching-create-step">
                  <div className="row">
                    <div className="col-lg-7">
                      <h4>Cá nhân hóa bài đăng</h4>

                      <div className="mb-3">
                        <label className="form-label">Tiêu đề bài đăng</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="VD: Tìm 2 người đánh kèo tối T7"
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
                              key={o.value}
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
                        <label className="form-label">Ghi chú</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          placeholder="Thêm ghi chú cho đồng đội (VD: mang vợt, mang nước...)"
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                          maxLength={1000}
                        />
                      </div>
                    </div>

                    {/* ── Preview Card ── */}
                    <div className="col-lg-5">
                      <div className="matching-preview-card">
                        <h5>Xem trước bài đăng</h5>
                        <div className="matching-preview-body">
                          <h6>{form.title || `Tìm ${form.requiredPlayers} người đánh cầu lông`}</h6>
                          <p><i className="feather-map-pin"></i> {selectedBooking?.venueName}</p>
                          <p><i className="feather-clock"></i> {selectedItems.length} ca chơi</p>
                          <p><i className="feather-dollar-sign"></i> {formatPrice(pricePerPerson)}/người (chia {form.requiredPlayers + 1} người)</p>
                          {form.skillLevel && <span className="badge bg-info me-1">{skillOptions.find(o => o.value === form.skillLevel)?.label}</span>}
                          {form.genderPref && <span className="badge bg-secondary me-1">{form.genderPref}</span>}
                          <span className="badge bg-success">{expenseOptions.find(o => o.value === form.expenseSharing)?.label}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="matching-step-actions">
                    <button className="btn btn-outline-secondary" onClick={() => setStep(2)}>← Quay lại</button>
                    <button className="btn btn-primary" onClick={() => setStep(4)}>Tiếp tục →</button>
                  </div>
                </div>
              )}

              {/* ═══ STEP 4 — Xác nhận & Gửi ═══ */}
              {step === 4 && (
                <div className="matching-create-step">
                  <h4>Xác nhận thông tin</h4>

                  <div className="matching-confirm-card">
                    <div className="row">
                      <div className="col-md-6">
                        <h6>📍 Sân</h6>
                        <p>{selectedBooking?.venueName}</p>
                        <p className="text-muted">{selectedBooking?.venueAddress}</p>

                        <h6>📅 Ca chơi ({selectedItems.length})</h6>
                        {selectedItems.map((item) => (
                          <p key={item.id} className="mb-1">
                            <strong>{item.courtName}</strong> — {formatDate(item.startTime)} {formatTime(item.startTime)} → {formatTime(item.endTime)} ({formatPrice(item.price)})
                          </p>
                        ))}
                      </div>
                      <div className="col-md-6">
                        <h6>👥 Tuyển</h6>
                        <p>{form.requiredPlayers} người — {formatPrice(pricePerPerson)}/người</p>

                        <h6>🏸 Yêu cầu</h6>
                        <p>
                          Trình độ: {skillOptions.find(o => o.value === form.skillLevel)?.label || 'Tất cả'}<br />
                          Giới tính: {form.genderPref || 'Không yêu cầu'}<br />
                          Chia tiền: {expenseOptions.find(o => o.value === form.expenseSharing)?.label}
                        </p>

                        {form.notes && (
                          <>
                            <h6>📝 Ghi chú</h6>
                            <p>{form.notes}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="matching-step-actions">
                    <button className="btn btn-outline-secondary" onClick={() => setStep(3)}>← Chỉnh sửa</button>
                    <button
                      className="btn btn-success btn-lg"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <><span className="spinner-border spinner-border-sm me-2" /> Đang tạo...</>
                      ) : (
                        <>🏸 Đăng bài tuyển đồng đội</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
