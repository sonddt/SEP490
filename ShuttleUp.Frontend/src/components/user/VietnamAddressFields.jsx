import { useMemo } from 'react';
import SearchableSelect from '../ui/SearchableSelect';
import { districtByCode, provinceByCode } from '../../utils/vietnamDivisions';

/**
 * Tỉnh / Quận-Huyện / Phường-Xã (dropdown có tìm kiếm) + địa chỉ nhà/đường (nhập tay).
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

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: String(p.c), label: p.n })),
    [provinces]
  );
  const districtOptions = useMemo(
    () => districts.map((d) => ({ value: String(d.c), label: d.n })),
    [districts]
  );
  const wardOptions = useMemo(
    () => wards.map((w) => ({ value: String(w.c), label: w.n })),
    [wards]
  );

  return (
    <>
      <div className="col-lg-4 col-md-6">
        <div className="input-space">
          <label className="form-label user-profile-form-label">Tỉnh / Thành phố</label>
          <SearchableSelect
            options={provinceOptions}
            value={provinceCode ? String(provinceCode) : ''}
            onChange={onChangeProvinceCode}
            placeholder={tree ? '-- Chọn tỉnh / thành phố --' : 'Đang tải danh sách...'}
            disabled={disabled || !tree}
          />
        </div>
      </div>

      <div className="col-lg-4 col-md-6">
        <div className="input-space">
          <label className="form-label user-profile-form-label">Quận / Huyện</label>
          <SearchableSelect
            options={districtOptions}
            value={districtCode ? String(districtCode) : ''}
            onChange={onChangeDistrictCode}
            placeholder="-- Chọn quận / huyện --"
            disabled={disabled || !tree || !provinceCode}
          />
        </div>
      </div>

      <div className="col-lg-4 col-md-6">
        <div className="input-space">
          <label className="form-label user-profile-form-label">Phường / Xã</label>
          <SearchableSelect
            options={wardOptions}
            value={wardCode ? String(wardCode) : ''}
            onChange={onChangeWardCode}
            placeholder="-- Chọn phường / xã --"
            disabled={disabled || !tree || !districtCode}
          />
        </div>
      </div>

      <div className="col-lg-12 col-md-12">
        <div className="input-space">
          <label className="form-label user-profile-form-label">Số nhà, tên đường</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ví dụ: 12 ngõ 3, phố Đại Cồ Việt"
            value={street}
            disabled={disabled}
            onChange={(e) => onStreetChange(e.target.value)}
          />
          <small className="user-profile-form-hint text-muted d-block mt-1">
            Nhập số nhà và tên đường; phường/xã chọn ở trên.
          </small>
        </div>
      </div>
    </>
  );
}
