export default function BookingFilters({ search, onSearch, timeFilter, onTimeFilter, sortBy, onSortBy, total, showing }) {
  return (
    <div className="bk-filters card border-0 shadow-sm mb-4">
      <div className="card-body py-3">
        <div className="row g-2 align-items-center">

          {/* Search */}
          <div className="col-lg-5 col-md-5">
            <div className="bk-search-wrap">
              <i className="feather-search bk-search-icon" />
              <input
                type="text"
                className="form-control bk-search-input"
                placeholder="Tìm theo tên người đặt, tên sân, cụm sân..."
                value={search}
                onChange={(e) => onSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="bk-search-clear" onClick={() => onSearch('')}>
                  <i className="feather-x" />
                </button>
              )}
            </div>
          </div>

          {/* Time filter */}
          <div className="col-lg-3 col-md-3 col-6">
            <div className="d-flex align-items-center gap-2">
              <i className="feather-calendar" style={{ color: '#94a3b8', fontSize: 15, flexShrink: 0 }} />
              <select
                className="form-select form-select-sm"
                value={timeFilter}
                onChange={(e) => onTimeFilter(e.target.value)}
              >
                <option value="all">Tất cả thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
              </select>
            </div>
          </div>

          {/* Sort */}
          <div className="col-lg-3 col-md-3 col-6">
            <div className="d-flex align-items-center gap-2">
              <i className="feather-bar-chart-2" style={{ color: '#94a3b8', fontSize: 15, flexShrink: 0 }} />
              <select
                className="form-select form-select-sm"
                value={sortBy}
                onChange={(e) => onSortBy(e.target.value)}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="amount_high">Giá cao nhất</option>
                <option value="amount_low">Giá thấp nhất</option>
              </select>
            </div>
          </div>

          {/* Count */}
          <div className="col-lg-1 col-md-1 text-end d-none d-md-block">
            <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              {showing}/{total}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
