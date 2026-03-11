const stats = [
  { value: '150+', label: 'Sân Hệ Thống' },
  { value: '80+', label: 'Quản Lý Sân' },
  { value: '5000+', label: 'Người Chơi' },
  { value: '200+', label: 'Giải Đấu' },
];

export default function StatsCounter() {
  return (
    <section className="section counter-section">
      <div className="container">
        <div className="counter-box">
          <div className="row">
            {stats.map((s, i) => (
              <div key={i} className="col-lg-3 col-md-6 d-flex">
                <div className="count-group w-100 aos" data-aos="fade-up">
                  <div className="customer-count">
                    <h3>{s.value}</h3>
                    <p>{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
