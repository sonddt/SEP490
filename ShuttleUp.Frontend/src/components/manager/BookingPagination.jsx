export default function BookingPagination({ currentPage, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }) {
  if (totalPages <= 1 && totalItems <= pageSize) return null;

  const pages = [];
  const delta = 2;
  const left  = Math.max(2, currentPage - delta);
  const right = Math.min(totalPages - 1, currentPage + delta);

  pages.push(1);
  if (left > 2) pages.push('...');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push('...');
  if (totalPages > 1) pages.push(totalPages);

  const start = (currentPage - 1) * pageSize + 1;
  const end   = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="bk-pagination">
      <span className="bk-pagination-info">
        Hiển thị {start}–{end} trong {totalItems} kết quả
      </span>

      <div className="d-flex align-items-center gap-2">
        {/* Per-page selector */}
        <div className="d-flex align-items-center gap-1" style={{ fontSize: 12, color: '#94a3b8' }}>
          <span>Hiển thị</span>
          <select
            className="form-select form-select-sm"
            style={{ width: 65, fontSize: 12 }}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>dòng</span>
        </div>

        {/* Page buttons */}
        <nav>
          <ul className="pagination pagination-sm mb-0 gap-1">
            <li className={`page-item${currentPage === 1 ? ' disabled' : ''}`}>
              <button
                type="button"
                className="page-link bk-page-btn"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <i className="feather-chevron-left" style={{ fontSize: 13 }} />
              </button>
            </li>

            {pages.map((p, i) =>
              p === '...' ? (
                <li key={`ellipsis-${i}`} className="page-item disabled">
                  <span className="page-link bk-page-btn">…</span>
                </li>
              ) : (
                <li key={p} className={`page-item${currentPage === p ? ' active' : ''}`}>
                  <button
                    type="button"
                    className="page-link bk-page-btn"
                    onClick={() => onPageChange(p)}
                  >
                    {p}
                  </button>
                </li>
              )
            )}

            <li className={`page-item${currentPage === totalPages ? ' disabled' : ''}`}>
              <button
                type="button"
                className="page-link bk-page-btn"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <i className="feather-chevron-right" style={{ fontSize: 13 }} />
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
