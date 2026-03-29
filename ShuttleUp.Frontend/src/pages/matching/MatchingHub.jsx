import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import matchingApi from '../../api/matchingApi';
import MatchingPostCard from '../../components/matching/MatchingPostCard';
import MatchingFilter from '../../components/matching/MatchingFilter';

export default function MatchingHub() {
  const [tab, setTab] = useState('all'); // 'all' | 'my'
  const [posts, setPosts] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ skillLevel: '', playDate: '', province: '', sort: 'newest' });

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, pageSize: 12 };
      if (filters.skillLevel) params.skillLevel = filters.skillLevel;
      if (filters.playDate) params.playDate = filters.playDate;
      if (filters.province) params.province = filters.province;
      if (filters.sort) params.sort = filters.sort;

      const res = await matchingApi.getPosts(params);
      setPosts(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Load posts error', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const loadMyPosts = useCallback(async () => {
    try {
      const res = await matchingApi.getMyPosts();
      setMyPosts(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Load my posts error', err);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (tab === 'my') loadMyPosts();
  }, [tab, loadMyPosts]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <>
      {/* ── Breadcrumb ── */}
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="row">
            <div className="col-md-12 col-12">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                  <li className="breadcrumb-item"><Link to="/">Trang chủ</Link></li>
                  <li className="breadcrumb-item active" aria-current="page">Tìm đồng đội</li>
                </ol>
              </nav>
              <h2 className="breadcrumb-title">Tìm đồng đội 🏸</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="content matching-hub-content">
        <div className="container">

          {/* ── Header Bar ── */}
          <div className="matching-hub-header">
            <div className="matching-hub-header-left">
              <div className="matching-tabs">
                <button
                  className={`matching-tab ${tab === 'all' ? 'active' : ''}`}
                  onClick={() => setTab('all')}
                >
                  Tất cả bài đăng
                </button>
                <button
                  className={`matching-tab ${tab === 'my' ? 'active' : ''}`}
                  onClick={() => setTab('my')}
                >
                  Bài đăng của tôi
                </button>
              </div>
              <span className="matching-count">{tab === 'all' ? total : myPosts.length} bài đăng</span>
            </div>
            <Link to="/matching/create" className="btn btn-primary matching-create-btn">
              <i className="feather-plus"></i> Tạo bài đăng
            </Link>
          </div>

          {/* ── Filter (only for 'all' tab) ── */}
          {tab === 'all' && (
            <MatchingFilter filters={filters} onFilterChange={handleFilterChange} />
          )}

          {/* ── Grid ── */}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Đang tải...</span>
              </div>
            </div>
          ) : (
            <>
              {tab === 'all' ? (
                <>
                  {posts.length === 0 ? (
                    <div className="matching-empty-state">
                      <div className="matching-empty-icon">🏸</div>
                      <h3>Chưa có bài đăng nào</h3>
                      <p>Hãy là người đầu tiên tạo bài tuyển đồng đội!</p>
                      <Link to="/matching/create" className="btn btn-primary">
                        <i className="feather-plus"></i> Tạo bài đăng ngay
                      </Link>
                    </div>
                  ) : (
                    <div className="row">
                      {posts.map((p) => (
                        <MatchingPostCard key={p.id} post={p} />
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="matching-pagination">
                      <nav>
                        <ul className="pagination justify-content-center">
                          <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => setPage(page - 1)}>‹</button>
                          </li>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                              <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                            </li>
                          ))}
                          <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => setPage(page + 1)}>›</button>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  )}
                </>
              ) : (
                /* ── My Posts Tab ── */
                <>
                  {myPosts.length === 0 ? (
                    <div className="matching-empty-state">
                      <div className="matching-empty-icon">📝</div>
                      <h3>Bạn chưa tạo bài đăng nào</h3>
                      <p>Hãy tạo bài đăng để tìm đồng đội!</p>
                      <Link to="/matching/create" className="btn btn-primary">
                        <i className="feather-plus"></i> Tạo bài đăng
                      </Link>
                    </div>
                  ) : (
                    <div className="row">
                      {myPosts.map((p) => (
                        <MatchingPostCard key={p.id} post={p} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
