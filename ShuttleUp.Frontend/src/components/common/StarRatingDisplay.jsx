/**
 * Hiển thị sao 0–5 với nửa sao (Font Awesome: fa-star-half-alt).
 */
export default function StarRatingDisplay({ value, className = '', size = 14 }) {
  const v = Math.min(5, Math.max(0, Number(value) || 0));
  const stars = [];
  for (let i = 0; i < 5; i++) {
    const fullAt = i + 1;
    const halfAt = i + 0.5;
    if (v >= fullAt) {
      stars.push(<i key={i} className="fas fa-star filled" style={{ fontSize: size }} aria-hidden />);
    } else if (v >= halfAt) {
      stars.push(
        <i key={i} className="fas fa-star-half-alt filled" style={{ fontSize: size }} aria-hidden />
      );
    } else {
      stars.push(<i key={i} className="fas fa-star" style={{ fontSize: size, opacity: 0.28 }} aria-hidden />);
    }
  }

  return (
    <span className={`star-rating-display d-inline-flex align-items-center gap-0 ${className}`} title={`${v.toFixed(1)} / 5`}>
      {stars}
    </span>
  );
}
