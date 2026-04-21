import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchableSelect from '../ui/SearchableSelect';
import { loadVietnamDivisionTree } from '../../utils/vietnamDivisions';

export default function HeroSection() {
  const [keyword, setKeyword] = useState('');
  const [locationStr, setLocationStr] = useState('');
  const [tree, setTree] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadVietnamDivisionTree().then(setTree).catch(() => {});
  }, []);

  const provinceOptions = useMemo(() => {
    if (!tree) return [];
    return tree.map((p) => ({ value: p.n, label: p.n }));
  }, [tree]);

  const handleSearch = (e) => {
    e.preventDefault();
    const queryParts = [];
    if (keyword) queryParts.push(keyword);
    if (locationStr) queryParts.push(locationStr);
    
    if (queryParts.length > 0) {
      navigate(`/venues?q=${encodeURIComponent(queryParts.join(' '))}`);
    } else {
      navigate('/venues');
    }
  };

  return (
    <section className="hero-section">
      <div className="banner-cock-one">
        <img src="/assets/img/icons/banner-cock1.svg" alt="Banner" />
      </div>
      <div className="banner-shapes">
        <div className="banner-dot-one"><span></span></div>
        <div className="banner-cock-two">
          <img src="/assets/img/icons/banner-cock2.svg" alt="Banner" />
          <span></span>
        </div>
        <div className="banner-dot-two"><span></span></div>
      </div>
      <div className="container">
        <div className="home-banner">
          <div className="row align-items-center w-100">
            <div className="col-lg-7 col-md-10 mx-auto">
              <div className="section-search aos" data-aos="fade-up">
                <h4>Hệ Thống Sân Cầu Lông Cao Cấp &amp; Quản Lý Chuyên Nghiệp</h4>
                <h1>Chọn <span>Sân Chơi</span> Và Bắt Đầu Đam Mê Của Bạn</h1>
                <p className="sub-info">
                  Khám phá tiềm năng thể thao của bạn với các sân tập hiện đại, quy trình đặt lịch nhanh chóng và dễ dàng.
                </p>
                <div className="search-box rounded-3 shadow-sm bg-white p-2">
                  <form onSubmit={handleSearch} className="d-flex align-items-end gap-3">
                    <div className="search-input">
                      <div className="form-group mb-0">
                        <label className="fw-bold mb-1 ms-1" style={{ fontSize: '13px' }}>Tìm kiếm Tên Sân</label>
                        <div className="border rounded-3 px-3 bg-white d-flex align-items-center" style={{ height: '44px' }}>
                          <input 
                            type="text" 
                            className="form-control border-0 shadow-none bg-transparent p-0" 
                            placeholder="Nhập tên sân..." 
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="search-input">
                      <div className="form-group mb-0">
                        <label className="fw-bold mb-1 ms-1" style={{ fontSize: '13px' }}>Khu vực (Tỉnh/Thành)</label>
                        <div className="border rounded-3 px-3 bg-white" style={{ height: '44px', display: 'flex', alignItems: 'center' }}>
                          <SearchableSelect
                            className="w-100"
                            triggerClass="py-0"
                            options={provinceOptions}
                            value={locationStr}
                            onChange={setLocationStr}
                            placeholder={tree ? '-- Chọn tỉnh / thành phố --' : 'Đang tải...'}
                            searchPlaceholder="Tìm kiếm..."
                            emptyLabel="Đang tải danh sách..."
                            notFoundLabel="Không tìm thấy khu vực"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="search-btn">
                      <button type="submit" className="btn border-0 outline-none">
                        <i className="feather-search"></i><span className="search-text">Tìm kiếm</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="banner-imgs text-center aos" data-aos="fade-up">
                <img className="img-fluid" src="/assets/img/bg/banner-right.png" alt="Banner" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
