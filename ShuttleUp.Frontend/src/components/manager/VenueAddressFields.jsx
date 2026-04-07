import { provinceByCode, districtByCode } from '../../utils/vietnamDivisions';

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

  const selectCls = 'form-select bg-light border-0';

  return (
    <div className="row g-3">
      <div className="col-12 col-md-4">
        <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: 13 }}>
          Tỉnh / Thành phố <span className="text-danger">*</span>
        </label>
        <select
          className={selectCls}
          value={provinceCode}
          disabled={disabled || !tree}
          onChange={(e) => onChangeProvince(e.target.value)}
        >
          <option value="">{tree ? '-- Chọn tỉnh / thành phố --' : 'Đang tải…'}</option>
          {provinces.map((p) => (
            <option key={p.c} value={String(p.c)}>{p.n}</option>
          ))}
        </select>
      </div>

      <div className="col-12 col-md-4">
        <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: 13 }}>
          Quận / Huyện <span className="text-danger">*</span>
        </label>
        <select
          className={selectCls}
          value={districtCode}
          disabled={disabled || !tree || !provinceCode}
          onChange={(e) => onChangeDistrict(e.target.value)}
        >
          <option value="">-- Chọn quận / huyện --</option>
          {districts.map((d) => (
            <option key={d.c} value={String(d.c)}>{d.n}</option>
          ))}
        </select>
      </div>

      <div className="col-12 col-md-4">
        <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: 13 }}>
          Phường / Xã
        </label>
        <select
          className={selectCls}
          value={wardCode}
          disabled={disabled || !tree || !districtCode}
          onChange={(e) => onChangeWard(e.target.value)}
        >
          <option value="">-- Chọn phường / xã --</option>
          {wards.map((w) => (
            <option key={w.c} value={String(w.c)}>{w.n}</option>
          ))}
        </select>
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
