import { districtByCode, provinceByCode } from '../../utils/vietnamDivisions';

/**
 * Tỉnh / Quận-Huyện / Phường-Xã (dropdown cascade) + địa chỉ nhà/đường (nhập tay).
 * @param {Array|null} tree — cây từ loadVietnamDivisionTree()
 */
export default function VietnamAddressFields({
  tree,
  street,
  onStreetChange,
  provinceCode,
  districtCode,
  wardCode,
  onChangeProvinceCode,
  onChangeDistrictCode,
  onChangeWardCode,
  disabled,
}) {
  const provinces = tree || [];
  const prov = provinceByCode(provinces, provinceCode);
  const districts = prov?.d || [];
  const dist = districtByCode(provinces, provinceCode, districtCode);
  const wards = dist?.w || [];

  return (
    <>
      <div className="col-lg-4 col-md-6">
        <div className="input-space">
          <label className="form-label">Tỉnh / Thành phố</label>
          <select
            className="form-control"
            value={provinceCode}
            disabled={disabled || !tree}
            onChange={(e) => onChangeProvinceCode(e.target.value)}
          >
            <option value="">{tree ? '-- Chọn tỉnh / thành phố --' : 'Đang tải danh sách...'}</option>
            {provinces.map((p) => (
              <option key={p.c} value={String(p.c)}>
                {p.n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="col-lg-4 col-md-6">
        <div className="input-space">
          <label className="form-label">Quận / Huyện</label>
          <select
            className="form-control"
            value={districtCode}
            disabled={disabled || !tree || !provinceCode}
            onChange={(e) => onChangeDistrictCode(e.target.value)}
          >
            <option value="">-- Chọn quận / huyện --</option>
            {districts.map((d) => (
              <option key={d.c} value={String(d.c)}>
                {d.n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="col-lg-4 col-md-6">
        <div className="input-space">
          <label className="form-label">Phường / Xã</label>
          <select
            className="form-control"
            value={wardCode}
            disabled={disabled || !tree || !districtCode}
            onChange={(e) => onChangeWardCode(e.target.value)}
          >
            <option value="">-- Chọn phường / xã --</option>
            {wards.map((w) => (
              <option key={w.c} value={String(w.c)}>
                {w.n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="col-lg-12 col-md-12">
        <div className="input-space">
          <label className="form-label">Số nhà, tên đường</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ví dụ: 12 ngõ 3, phố Đại Cồ Việt"
            value={street}
            disabled={disabled}
            onChange={(e) => onStreetChange(e.target.value)}
          />
          <small className="text-muted d-block mt-1">
            Nhập số nhà và tên đường; phường/xã chọn ở trên.
          </small>
        </div>
      </div>
    </>
  );
}
