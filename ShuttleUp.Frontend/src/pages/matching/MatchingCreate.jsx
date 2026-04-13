import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import matchingApi from '../../api/matchingApi';
import MatchingPeopleCountInput from '../../components/matching/MatchingPeopleCountInput';

const skillOptions = [
  { value: '', label: 'Không yêu cầu' },
  { value: 'Yếu', label: 'Yếu / Mới chơi' },
  { value: 'Trung Bình Yếu', label: 'Trung Bình Yếu' },
  { value: 'Trung Bình', label: 'Trung Bình' },
  { value: 'Khá', label: 'Khá' },
  { value: 'Bán Chuyên', label: 'Bán Chuyên' },
  { value: 'Chuyên Nghiệp', label: 'Chuyên nghiệp' }
];

const genderOptions = [
  { value: '', label: 'Không yêu cầu' },
  { value: 'Nam', label: 'Nam' },
  { value: 'Nữ', label: 'Nữ' },
];

const expenseOptions = [
  { value: 'split_equal', label: 'Chia đều (Sân + Cầu)' },
  { value: 'host_pays', label: 'Miễn phí giao lưu (Bao sân)' },
  { value: 'female_free', label: 'Nam bao Nữ' },
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
  const [step2Page, setStep2Page] = useState(1);
  const ITEMS_PER_PAGE_STEP2 = 5;
  const [showAllItems, setShowAllItems] = useState(false);
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
    setStep2Page(1);
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
  const bookingHasDiscount = Boolean(selectedBooking?.hasDiscount);

  const renderPricePerPerson = () => {
    if (form.expenseSharing === 'negotiable') return 'Thỏa thuận';
    if (form.expenseSharing === 'host_pays') return 'Miễn phí';
    
    if (form.expenseSharing === 'female_free') {
      const splitPrice = form.requiredPlayers > 0 ? Math.round(totalPrice / (form.requiredPlayers + 1)) : totalPrice;
      return `Nam: ~${formatPrice(splitPrice)} / Nữ: 0đ`;
    }

    // split_equal (default)
    const splitPrice = form.requiredPlayers > 0 ? Math.round(totalPrice / (form.requiredPlayers + 1)) : totalPrice;
    return formatPrice(splitPrice);
  };

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
                  <h4 className="fw-bold" style={{ color: '#1e293b' }}>Chọn ca chơi muốn tìm đồng đội</h4>
                  <p style={{ color: '#64748b', marginBottom: '32px' }}><i className="feather-map-pin me-2"></i>{selectedBooking.venueName} — {selectedBooking.venueAddress}</p>
                  {bookingHasDiscount && (
                    <div className="alert alert-info" style={{ marginTop: '-12px', marginBottom: '24px' }}>
                      Giá đã bao gồm các ưu đãi/mã giảm giá áp dụng cho đơn hàng này.
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h5 style={{ margin: 0, fontWeight: '700', color: '#1e293b' }}>Danh sách ca chơi</h5>
                    <button 
                      onClick={toggleAllItems}
                      style={{ 
                        background: 'none', border: 'none', color: '#097E52', 
                        fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                        padding: '6px 12px', borderRadius: '6px', transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(9, 126, 82, 0.08)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      {selectedItemIds.length === (selectedBooking.items?.length || 0) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>

                  <div className="matching-items-list">
                    {(() => {
                        const itemsStep2 = selectedBooking.items || [];
                        const totalStep2Pages = Math.ceil(itemsStep2.length / ITEMS_PER_PAGE_STEP2);
                        const visibleItemsStep2 = itemsStep2.slice((step2Page - 1) * ITEMS_PER_PAGE_STEP2, step2Page * ITEMS_PER_PAGE_STEP2);
                        
                        const getPaginationGroups = () => {
                            const pages = [];
                            for (let i = 1; i <= totalStep2Pages; i++) {
                                if (i === 1 || i === totalStep2Pages || (i >= step2Page - 1 && i <= step2Page + 1)) {
                                    pages.push(i);
                                } else if (pages[pages.length - 1] !== '...') {
                                    pages.push('...');
                                }
                            }
                            return pages;
                        };

                        return (
                            <>
                                {visibleItemsStep2.map((item) => {
                      const isSelected = selectedItemIds.includes(item.id);
                      return (
                        <div 
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          style={{
                            border: isSelected ? '2px solid #097E52' : '1px solid #e9eef4',
                            backgroundColor: isSelected ? 'rgba(9, 126, 82, 0.03)' : '#fff',
                            borderRadius: '16px',
                            padding: '16px 20px',
                            marginBottom: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? '0 8px 20px rgba(9, 126, 82, 0.08)' : '0 2px 8px rgba(0,0,0,0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#e9eef4';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
                            }
                          }}
                        >
                          {isSelected && (
                            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', backgroundColor: '#097E52' }} />
                          )}
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ 
                              width: '54px', height: '54px', borderRadius: '14px', 
                              backgroundColor: isSelected ? '#097E52' : '#f1f5f9',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: isSelected ? '#fff' : '#64748b',
                              transition: 'all 0.2s ease',
                              flexShrink: 0
                            }}>
                              <i className="feather-clock" style={{ fontSize: '22px' }}></i>
                            </div>
                            
                            <div>
                              <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                {formatTime(item.startTime)} - {formatTime(item.endTime)}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '13.5px', color: '#64748b', fontWeight: '500' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <i className="feather-layers opacity-75"></i> {item.courtName}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <i className="feather-calendar opacity-75"></i> {formatDate(item.startTime)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '22px', fontWeight: '800', color: '#097E52', marginBottom: '4px', letterSpacing: '-0.5px' }}>
                              {formatPrice(item.price)}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: isSelected ? '#097E52' : '#94a3b8', letterSpacing: '0.5px' }}>
                              {isSelected ? 'ĐÃ CHỌN LỊCH' : 'CHỌN CA NÀY'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {totalStep2Pages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                        <nav>
                          <ul className="pagination" style={{ gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 0 }}>
                            <li className={`page-item ${step2Page <= 1 ? 'disabled' : ''}`}>
                              <button className="page-link" style={{ borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontWeight: '700', color: '#1e293b' }} onClick={() => setStep2Page(step2Page - 1)}>‹</button>
                            </li>
                            {getPaginationGroups().map((p, idx) => (
                              <li key={idx} className={`page-item ${p === '...' ? 'disabled' : ''}`}>
                                <button className="page-link" style={{ borderRadius: '10px', minWidth: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: p === step2Page ? '#097E52' : '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontWeight: '700', color: p === step2Page ? '#fff' : p === '...' ? '#94a3b8' : '#1e293b', padding: '0 10px', fontSize: '14px' }} onClick={() => { if (p !== '...') setStep2Page(p); }}>{p}</button>
                              </li>
                            ))}
                            <li className={`page-item ${step2Page >= totalStep2Pages ? 'disabled' : ''}`}>
                              <button className="page-link" style={{ borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontWeight: '700', color: '#1e293b' }} onClick={() => setStep2Page(step2Page + 1)}>›</button>
                            </li>
                          </ul>
                        </nav>
                      </div>
                    )}
                  </>
                );
              })()}
                  </div>

                  {selectedItemIds.length > 0 && (
                    <div style={{
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      borderRadius: '20px',
                      padding: '24px 32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid #e2e8f0',
                      marginTop: '32px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ 
                          width: '64px', height: '64px', borderRadius: '18px', 
                          backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#097E52'
                        }}>
                          <i className="feather-check-circle" style={{ fontSize: '28px' }}></i>
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            TỔNG SỐ CA
                          </div>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b' }}>
                            {selectedItemIds.length} ca chơi
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                          TỔNG THANH TOÁN
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: '#097E52', letterSpacing: '-1px' }}>
                          {formatPrice(totalPrice)}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="matching-step-actions mt-4 pt-3 border-top" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button 
                      className="btn" 
                      style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600', padding: '12px 24px', borderRadius: '12px' }}
                      onClick={() => setStep(1)}
                    >
                      ← Quay lại
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={selectedItemIds.length === 0}
                      onClick={() => setStep(3)}
                      style={{ padding: '12px 36px', borderRadius: '12px', fontSize: '16px', fontWeight: '700', boxShadow: '0 6px 16px rgba(9,126,82,0.2)' }}
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
                        <label className="form-label">Mục đích chơi</label>
                        <select
                          className="form-select"
                          value={form.playPurpose}
                          onChange={(e) => setForm({ ...form, playPurpose: e.target.value })}
                        >
                          <option value="">-- Không yêu cầu --</option>
                          <option value="Giải trí, vận động">Giải trí, vận động</option>
                          <option value="Tập luyện nghiêm túc">Tập luyện nghiêm túc</option>
                          <option value="Tìm partner cố định">Tìm partner cố định</option>
                          <option value="Đánh giải, cọ xát">Đánh giải, cọ xát</option>
                        </select>
                      </div>

                      <div className="mb-3">
                        <label className="form-label">Ghi chú</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          placeholder="Tip: Ghi chú thêm về phong cách chơi (vui vẻ, hòa đồng hay đánh chiến thuật), luật sân con, hoặc thông tin cầu..."
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
                          <p><i className="feather-dollar-sign"></i> {renderPricePerPerson()} {form.expenseSharing === 'split_equal' && `(chia ${form.requiredPlayers + 1} người)`}</p>
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
                  <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#e8f5ee', color: '#097E52', marginBottom: '20px' }}>
                        <i className="feather-check" style={{ fontSize: '40px' }}></i>
                    </div>
                    <h3 style={{ fontWeight: '800', color: '#1e293b', marginBottom: '12px' }}>Kiểm tra lần cuối</h3>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>Vui lòng xem lại thông tin bài viết trước khi báo danh đồng đội</p>
                  </div>

                  <div style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 20px 40px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    {bookingHasDiscount && (
                      <div className="alert alert-info mb-0 rounded-0" style={{ borderLeft: '0', borderRight: '0', borderTop: '0' }}>
                        Giá đã bao gồm các ưu đãi/mã giảm giá áp dụng cho đơn hàng này.
                      </div>
                    )}
                    
                    <div style={{ padding: '32px 40px', background: '#f8fafc', borderBottom: '1px dashed #cbd5e1' }}>
                        <h4 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', margin: 0, lineHeight: '1.4' }}>
                          {form.title || `Tìm ${form.requiredPlayers} người đánh cầu lông ghép kèo`}
                        </h4>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 320px', padding: '40px', borderRight: '1px dashed #cbd5e1', borderBottom: '1px dashed #cbd5e1' }}>
                            <div style={{ marginBottom: '36px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}><i className="feather-map-pin me-2"></i>ĐỊA ĐIỂM SÂN</div>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>{selectedBooking?.venueName}</div>
                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500', lineHeight: '1.5' }}>{selectedBooking?.venueAddress}</div>
                            </div>
                            
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}><i className="feather-calendar me-2"></i>Lịch trình ({selectedItems.length} ca)</div>
                                {(showAllItems ? selectedItems : selectedItems.slice(0, 2)).map((item) => {
                                    const dateObj = new Date(item.startTime);
                                    const dayName = formatDate(item.startTime).split(',')[0];
                                    const dayDate = dateObj.getDate();
                                    return (
                                        <div key={item.id} style={{ display: 'flex', gap: '16px', marginBottom: '12px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                                            <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', flexShrink: 0 }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{dayName}</span>
                                                <span style={{ fontSize: '20px', fontWeight: '800', color: '#097E52', lineHeight: '1.1' }}>{dayDate < 10 ? `0${dayDate}` : dayDate}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <div style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>{formatTime(item.startTime)} - {formatTime(item.endTime)}</div>
                                                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>{item.courtName} • <span style={{ color: '#097E52' }}>{formatPrice(item.price)}</span></div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {selectedItems.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllItems(!showAllItems)}
                                        style={{ width: '100%', padding: '12px', marginTop: '4px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#097E52', fontWeight: '700', fontSize: '14px', transition: 'all 0.2s' }}
                                        onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                                        onMouseLeave={(e) => e.target.style.background = '#f8fafc'}
                                    >
                                        {showAllItems ? 'Thu gọn lịch trình' : `Xem thêm ${selectedItems.length - 2} ca chơi khác ↓`}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ flex: '1 1 320px', padding: '40px' }}>
                            <div style={{ marginBottom: '36px', display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1, padding: '20px 16px', backgroundColor: '#e8f5ee', borderRadius: '16px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#097E52', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Tuyển thêm</div>
                                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#065f3e' }}>{form.requiredPlayers} <span style={{ fontSize: '14px' }}>người</span></div>
                                </div>
                                <div style={{ flex: 1, padding: '20px 16px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Chi phí / ng</div>
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>{renderPricePerPerson()}</div>
                                </div>
                            </div>
                            
                            <div style={{ marginBottom: '32px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>🏸 YÊU CẦU ĐỒNG ĐỘI</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                                        <span style={{ color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center' }}><i className="feather-bar-chart-2 me-2"></i>Trình độ</span>
                                        <span style={{ color: '#1e293b', fontWeight: '800' }}>{skillOptions.find(o => o.value === form.skillLevel)?.label || 'Bất kỳ mức nào'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                                        <span style={{ color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center' }}><i className="feather-users me-2"></i>Giới tính</span>
                                        <span style={{ color: '#1e293b', fontWeight: '800' }}>{form.genderPref || 'Nam & Nữ đều được'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center' }}><i className="feather-credit-card me-2"></i>Chi phí</span>
                                        <span style={{ color: '#097E52', fontWeight: '800', display: 'flex', alignItems: 'center' }}>{expenseOptions.find(o => o.value === form.expenseSharing)?.label}</span>
                                    </div>
                                </div>
                            </div>

                            {form.notes && (
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>📝 THÔNG ĐIỆP GỬI GẮM</div>
                                    <div style={{ padding: '20px', backgroundColor: '#fffbeb', color: '#b45309', borderRadius: '16px', border: '1px solid #fde68a', fontSize: '14.5px', lineHeight: '1.6', fontWeight: '500' }}>
                                        {form.notes}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                  </div>

                  <div style={{ maxWidth: '800px', margin: '40px auto 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px dashed #e2e8f0', paddingTop: '32px' }}>
                    <button 
                      className="btn" 
                      onClick={() => setStep(3)}
                      style={{ backgroundColor: '#fff', border: '2px solid #e2e8f0', color: '#475569', fontWeight: '700', padding: '14px 28px', borderRadius: '16px' }}
                    >
                      ← Chỉnh sửa lại
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSubmit}
                      disabled={submitting}
                      style={{ padding: '14px 40px', borderRadius: '16px', fontSize: '16px', fontWeight: '800', boxShadow: '0 8px 24px rgba(9,126,82,0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {submitting ? (
                        <><span className="spinner-border spinner-border-sm" /> Đang tạo bài...</>
                      ) : (
                        <><i className="feather-send"></i> Đăng bài tuyển ngay</>
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
