import { useState, useCallback } from 'react';

/**
 * Interactive star rating: hover to preview, click to lock.
 * value=0 means nothing selected (all gray).
 */
export default function StarRatingInput({ value = 0, onChange, size = 28, count = 5 }) {
  const [hovered, setHovered] = useState(0);

  const handleClick = useCallback(
    (idx) => {
      onChange?.(idx);
    },
    [onChange],
  );

  const display = hovered || value;

  return (
    <span
      className="star-rating-input d-inline-flex align-items-center gap-0"
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: count }, (_, i) => {
        const idx = i + 1;
        const filled = idx <= display;
        return (
          <i
            key={i}
            className="fas fa-star"
            role="button"
            aria-label={`${idx} sao`}
            style={{
              fontSize: size,
              color: filled ? '#f5a623' : '#d1d5db',
              transition: 'color 0.12s ease',
              padding: '0 2px',
            }}
            onMouseEnter={() => setHovered(idx)}
            onClick={() => handleClick(idx)}
          />
        );
      })}
    </span>
  );
}
