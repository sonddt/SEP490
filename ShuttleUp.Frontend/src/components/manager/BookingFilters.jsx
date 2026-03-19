export default function BookingFilters({ search, onSearch, timeFilter, onTimeFilter, sortBy, onSortBy, total, showing }) {
  return (
    <div className="bk-filters-row">
      {/* Search — flex:1, takes remaining space */}
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

      {/* Time filter — no hard minWidth, let CSS handle it */}
      <select
        className="form-select"
        value={timeFilter}
        onChange={(e) => onTimeFilter(e.target.value)}
      >
        <option value="all">Tất cả thời gian</option>
        <option value="today">Hôm nay</option>
        <option value="week">Tuần này</option>
        <option value="month">Tháng này</option>
      </select>

      {/* Sort */}
      <select
        className="form-select"
        value={sortBy}
        onChange={(e) => onSortBy(e.target.value)}
      >
        <option value="newest">Mới nhất</option>
        <option value="oldest">Cũ nhất</option>
        <option value="amount_high">Giá cao nhất</option>
        <option value="amount_low">Giá thấp nhất</option>
      </select>

      <span className="bk-filter-count">{showing}/{total}</span>
    </div>
  );
}
