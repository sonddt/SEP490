import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/profileApi';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { loadVietnamDivisionTree, listDistrictNamesForProvince } from '../../utils/vietnamDivisions';

const PROVINCES = [
  'Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Ninh', 'Bến Tre',
  'Bình Định', 'Bình Dương', 'Bình Phước', 'Bình Thuận', 'Cà Mau',
  'Cao Bằng', 'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai',
  'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Tĩnh',
  'Hải Dương', 'Hậu Giang', 'Hoà Bình', 'Hưng Yên', 'Khánh Hoà',
  'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn',
  'Lào Cai', 'Long An', 'Nam Định', 'Nghệ An', 'Ninh Bình',
  'Ninh Thuận', 'Phú Thọ', 'Phú Yên', 'Quảng Bình', 'Quảng Nam',
  'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng', 'Sơn La',
  'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hoá', 'Thừa Thiên Huế',
  'Tiền Giang', 'Trà Vinh', 'Tuyên Quang', 'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
];

const Personalization = () => {
  const { user, updateUser } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    province: user?.province || 'Hà Nội',
    district: user?.district || '',
    gender: user?.gender || '',
    skillLevel: user?.skillLevel || '',
    playPurpose: user?.playPurpose || '',
    playFrequency: user?.playFrequency || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [divisionTree, setDivisionTree] = useState(null);
  const [divisionLoadError, setDivisionLoadError] = useState('');

  useEffect(() => {
    let ok = true;
    loadVietnamDivisionTree()
      .then((t) => {
        if (ok) {
          setDivisionTree(Array.isArray(t) ? t : []);
          setDivisionLoadError('');
        }
      })
      .catch(() => {
        if (ok) {
          setDivisionTree(null);
          setDivisionLoadError('Chưa tải được danh mục địa phương. Bạn tải lại trang hoặc bấm Bỏ qua nhé.');
        }
      });
    return () => {
      ok = false;
    };
  }, []);

  const currentDistricts = useMemo(
    () => listDistrictNamesForProvince(divisionTree, formData.province),
    [divisionTree, formData.province]
  );

  const provinceOptions = useMemo(() => PROVINCES.map((p) => ({ value: p, label: p })), []);

  const districtOptions = useMemo(
    () => currentDistricts.map((d) => ({ value: d, label: d })),
    [currentDistricts]
  );

  useEffect(() => {
    if (!divisionTree?.length) return;
    setFormData((prev) => {
      if (!prev.district) return prev;
      const names = listDistrictNamesForProvince(divisionTree, prev.province);
      if (names.includes(prev.district)) return prev;
      return { ...prev, district: '' };
    });
  }, [divisionTree]);

  const steps = [
    { id: 1, icon: 'fas fa-map-marker-alt', label: 'Vị trí', key: 'district' },
    { id: 2, icon: 'fas fa-venus-mars', label: 'Giới tính', key: 'gender' },
    { id: 3, icon: 'fas fa-medal', label: 'Trình độ', key: 'skillLevel' },
    { id: 4, icon: 'fas fa-bullseye', label: 'Mục tiêu', key: 'playPurpose' },
    { id: 5, icon: 'fas fa-calendar-alt', label: 'Tần suất', key: 'playFrequency' }
  ];

  const handleSelect = (key, value) => {
    setFormData((prev) => {
      if (key === 'province') {
        return { ...prev, province: value, district: '' };
      }
      return { ...prev, [key]: value };
    });
  };

  const handleNext = async () => {
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Final Submit
      setSaving(true);
      setError('');
      try {
        const payload = {
          fullName: user?.fullName || 'User',
          province: formData.province,
          district: formData.district,
          gender: formData.gender,
          skillLevel: formData.skillLevel,
          playPurpose: formData.playPurpose,
          playFrequency: formData.playFrequency,
          isPersonalized: true,
        };

        await profileApi.updateMe(payload);

        // Cập nhật local context để guard không chặn nữa
        updateUser({ ...payload });

        // Hard reload để xóa guard state triệt để
        window.location.href = '/venues';
      } catch (err) {
        console.error('Personalization save error:', err);
        setError('Oops... Lưu thất bại, bạn thử lại nhé!');
      } finally {
        setSaving(false);
      }
    }
  };

  const OptionButton = ({ label, value, stateKey, size = 'col-4' }) => {
    const selected = formData[stateKey] === (value || label);
    return (
      <div className={`${size} p-2`}>
        <button
          onClick={() => handleSelect(stateKey, value || label)}
          className="btn w-100"
          style={{
            borderRadius: '10px',
            height: '64px',
            fontWeight: '500',
            fontSize: '15px',
            transition: 'all 0.2s',
            backgroundColor: selected ? '#32b260' : '#f8fafc',
            color: selected ? '#fff' : '#344054',
            border: selected ? '2px solid #32b260' : '2px solid #e2e8f0',
            boxShadow: selected ? '0 2px 12px rgba(50,178,96,0.18)' : 'none',
          }}
        >
          {label}
        </button>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', paddingTop: '100px' }}>
      {/* Top Header */}
      <div
        className="d-flex align-items-center justify-content-between text-white px-4 py-3"
        style={{ backgroundColor: '#32b260' }}
      >
        <div style={{ width: '60px' }} />
        <h4 className="mb-0" style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>Cá nhân hoá</h4>
        <button
          className="btn text-white p-0 border-0"
          style={{ width: '60px', textAlign: 'right', fontWeight: 500, opacity: 0.85 }}
          onClick={() => {
            sessionStorage.setItem('skippedPersonalization', 'true');
            window.location.href = '/venues';
          }}
        >
          Bỏ qua
        </button>
      </div>

      <div className="container py-4" style={{ maxWidth: '760px' }}>
        {/* Progress Steps */}
        <div className="d-flex justify-content-between align-items-start mb-4 position-relative px-3">
          <div
            className="position-absolute"
            style={{ top: '22px', left: '12%', right: '12%', height: '2px', backgroundColor: '#dee2e6', zIndex: 0 }}
          />
          {steps.map((step) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const color = isActive || isCompleted ? '#32b260' : '#adb5bd';
            return (
              <div key={step.id} className="text-center position-relative" style={{ zIndex: 1, flex: 1 }}>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-1"
                  style={{
                    width: '44px', height: '44px',
                    backgroundColor: isActive || isCompleted ? '#32b260' : '#fff',
                    border: `2px solid ${color}`,
                    color: isActive || isCompleted ? '#fff' : color,
                    transition: 'all 0.3s',
                  }}
                >
                  {isCompleted
                    ? <i className="fas fa-check" style={{ fontSize: '15px' }} />
                    : <i className={step.icon} style={{ fontSize: '16px' }} />}
                </div>
                <small style={{ color, fontWeight: isActive ? 700 : 400, fontSize: '12px' }}>
                  {step.label}
                </small>
              </div>
            );
          })}
        </div>

        {/* Content Card */}
        <div className="card shadow-sm border-0" style={{ borderRadius: '16px' }}>
          <div className="card-body p-4 p-md-5">
            {error && <div className="alert alert-warning py-2 mb-3">{error}</div>}

            {/* STEP 1 */}
            {currentStep === 1 && (
              <div>
                <h5 className="fw-bold mb-1">📍 Vị trí yêu thích</h5>
                <p className="text-muted mb-4" style={{ fontSize: '14px' }}>Chúng tôi sẽ gợi ý các sân thể thao gần bạn nhất</p>
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="personalization-province">
                    Tỉnh / Thành phố
                  </label>
                  <SearchableSelect
                    id="personalization-province"
                    options={provinceOptions}
                    value={formData.province}
                    onChange={(v) => handleSelect('province', v)}
                    placeholder="-- Chọn tỉnh / thành phố --"
                    searchPlaceholder="Gõ tên tỉnh, thành phố…"
                  />
                </div>
                {divisionLoadError && (
                  <div className="alert alert-warning py-2 small mb-3">{divisionLoadError}</div>
                )}
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="personalization-district">
                    Khu vực (Quận / Huyện)
                  </label>
                  <SearchableSelect
                    id="personalization-district"
                    options={districtOptions}
                    value={formData.district}
                    onChange={(v) => handleSelect('district', v)}
                    placeholder={
                      !divisionTree?.length && !divisionLoadError
                        ? 'Đang tải danh sách…'
                        : '-- Chọn khu vực --'
                    }
                    searchPlaceholder="Gõ tên quận, huyện…"
                    disabled={!divisionTree?.length}
                  />
                  {divisionTree?.length > 0 && currentDistricts.length === 0 && (
                    <p className="text-muted small mt-2 mb-0">
                      Chưa tìm thấy quận/huyện cho tỉnh này trong danh mục. Thử chọn tỉnh khác hoặc bấm Bỏ qua.
                    </p>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2 mt-3">
                  {currentDistricts.map(d => (
                    <button
                      key={d}
                      onClick={() => handleSelect('district', d)}
                      className="btn btn-sm"
                      style={{
                        borderRadius: '20px',
                        padding: '5px 14px',
                        backgroundColor: formData.district === d ? '#32b260' : '#f1f5f9',
                        color: formData.district === d ? '#fff' : '#475569',
                        border: 'none',
                        fontWeight: formData.district === d ? 600 : 400,
                        fontSize: '13px',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {currentStep === 2 && (
              <div className="text-center">
                <h5 className="fw-bold mb-1">🙋 Giới tính của bạn</h5>
                <p className="text-muted mb-4" style={{ fontSize: '14px' }}>Giúp chúng tôi tìm đối luyện và đội nhóm phù hợp hơn</p>
                <div className="row justify-content-center">
                  <OptionButton label="👦 Nam" value="Nam" stateKey="gender" size="col-12 col-sm-4" />
                  <OptionButton label="👧 Nữ" value="Nữ" stateKey="gender" size="col-12 col-sm-4" />
                  <OptionButton label="🌈 Khác" value="Khác" stateKey="gender" size="col-12 col-sm-4" />
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {currentStep === 3 && (
              <div className="text-center">
                <h5 className="fw-bold mb-1">🏅 Trình độ kỹ năng</h5>
                <p className="text-muted mb-4" style={{ fontSize: '14px' }}>Trình độ hiện tại của bạn đang ở mức nào?</p>
                <div className="row justify-content-center">
                  <OptionButton label="🌱 Yếu / Mới chơi" value="Yếu" stateKey="skillLevel" size="col-12 col-sm-4" />
                  <OptionButton label="🥉 Trung Bình Yếu" value="Trung Bình Yếu" stateKey="skillLevel" size="col-12 col-sm-4" />
                  <OptionButton label="🥈 Trung Bình" value="Trung Bình" stateKey="skillLevel" size="col-12 col-sm-4" />
                  <OptionButton label="🥇 Khá" value="Khá" stateKey="skillLevel" size="col-12 col-sm-4" />
                  <OptionButton label="🔥 Bán Chuyên" value="Bán Chuyên" stateKey="skillLevel" size="col-12 col-sm-4" />
                  <OptionButton label="⚡ Chuyên Nghiệp" value="Chuyên Nghiệp" stateKey="skillLevel" size="col-12 col-sm-4" />
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {currentStep === 4 && (
              <div className="text-center">
                <h5 className="fw-bold mb-1">🎯 Mục tiêu của bạn</h5>
                <p className="text-muted mb-4" style={{ fontSize: '14px' }}>Bạn chơi thể thao chủ yếu để làm gì?</p>
                <div className="row justify-content-center">
                  <OptionButton label="💪 Giải trí, vận động" value="Giải trí, vận động" stateKey="playPurpose" size="col-12 col-sm-6" />
                  <OptionButton label="🎯 Tập luyện nghiêm túc" value="Tập luyện nghiêm túc" stateKey="playPurpose" size="col-12 col-sm-6" />
                  <OptionButton label="🤝 Tìm partner cố định" value="Tìm partner cố định" stateKey="playPurpose" size="col-12 col-sm-6" />
                  <OptionButton label="🏆 Đánh giải, cọ xát" value="Đánh giải, cọ xát" stateKey="playPurpose" size="col-12 col-sm-6" />
                </div>
              </div>
            )}

            {/* STEP 5 */}
            {currentStep === 5 && (
              <div className="text-center">
                <h5 className="fw-bold mb-1">📅 Tần suất chơi</h5>
                <p className="text-muted mb-4" style={{ fontSize: '14px' }}>Bạn thường ra sân bao nhiêu lần trong tuần?</p>
                <div className="row justify-content-center">
                  <OptionButton label="Thỉnh thoảng" value="Thỉnh thoảng" stateKey="playFrequency" size="col-12 col-sm-6" />
                  <OptionButton label="1-2 lần / tuần" value="1-2 lần/tuần" stateKey="playFrequency" size="col-12 col-sm-6" />
                  <OptionButton label="Chỉ cuối tuần" value="Chỉ cuối tuần" stateKey="playFrequency" size="col-12 col-sm-6" />
                  <OptionButton label="Hàng ngày" value="Hàng ngày" stateKey="playFrequency" size="col-12 col-sm-6" />
                </div>
              </div>
            )}
          </div>

          <div className="card-footer bg-white border-top-0 px-4 pb-4 d-flex justify-content-between align-items-center">
            <div>
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="btn btn-light"
                  style={{ borderRadius: '10px', padding: '10px 22px', fontWeight: 500 }}
                >
                  <i className="fas fa-chevron-left me-2" />Quay lại
                </button>
              )}
            </div>
            <button
              onClick={handleNext}
              disabled={!formData[steps[currentStep - 1].key] || saving}
              className="btn"
              style={{
                backgroundColor: formData[steps[currentStep - 1].key] ? '#32b260' : '#a0aec0',
                borderColor: 'transparent',
                color: '#fff',
                borderRadius: '10px',
                padding: '10px 32px',
                fontWeight: 600,
                fontSize: '15px',
                transition: 'all 0.2s',
              }}
            >
              {saving ? (
                <><span className="spinner-border spinner-border-sm me-2" />Đang lưu...</>
              ) : currentStep === 5 ? (
                '🎉 Hoàn tất'
              ) : (
                <>Tiếp tục <i className="fas fa-chevron-right ms-2" /></>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-muted mt-3" style={{ fontSize: '13px' }}>
          Bạn có thể thay đổi các thông tin này sau trong <strong>Hồ sơ cá nhân</strong>
        </p>
      </div>
    </div>
  );
};

export default Personalization;
