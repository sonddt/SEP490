const stats = [
  { value: '150+', label: 'Courts Available' },
  { value: '80+', label: 'Expert Coaches' },
  { value: '5000+', label: 'Happy Players' },
  { value: '200+', label: 'Tournaments Hosted' },
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
