import { useState } from 'react';
import ShuttleDateField from '../ui/ShuttleDateField';
import { SKILL_FILTER_OPTIONS } from '../../constants/skillLevels';

export default function MatchingFilter({ filters, onFilterChange }) {
  const [expanded, setExpanded] = useState(false);

  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="matching-filter-bar">
      <div className="matching-filter-row">
        {/* Skill Level */}
        <div className="matching-filter-item">
          <select
            className="form-select"
            value={filters.skillLevel || ''}
            onChange={(e) => handleChange('skillLevel', e.target.value)}
          >
            {SKILL_FILTER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Play Date */}
        <div className="matching-filter-item">
          <ShuttleDateField
            value={filters.playDate || ''}
            onChange={(ymd) => handleChange('playDate', ymd)}
            placeholder="Ngày chơi"
          />
        </div>

        {/* Province / Area */}
        <div className="matching-filter-item">
          <input
            type="text"
            className="form-control"
            placeholder="Khu vực (VD: Hồ Chí Minh)"
            value={filters.province || ''}
            onChange={(e) => handleChange('province', e.target.value)}
          />
        </div>

        {/* Sort */}
        <div className="matching-filter-item">
          <select
            className="form-select"
            value={filters.sort || 'newest'}
            onChange={(e) => handleChange('sort', e.target.value)}
          >
            <option value="newest">Mới nhất</option>
            <option value="price_asc">Giá thấp nhất</option>
            <option value="soonest">Sắp diễn ra</option>
          </select>
        </div>

        {/* Reset */}
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => onFilterChange({ skillLevel: '', playDate: '', province: '', sort: 'newest' })}
        >
          <i className="feather-x"></i> Xóa bộ lọc
        </button>
      </div>
    </div>
  );
}
