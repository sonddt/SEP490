import { useEffect, useState } from 'react';

/**
 * Ô nhập số người: gõ tay (có thể xóa hết), không đổi khi cuộn chuột, có nút ▲▼.
 */
export default function MatchingPeopleCountInput({
  value,
  onChange,
  min = 1,
  max = 20,
  id,
  className = '',
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (n) => Math.max(min, Math.min(max, n));

  const applyNumber = (n) => {
    const c = clamp(n);
    onChange(c);
    setText(String(c));
  };

  const currentNum = () => {
    if (text === '') return min;
    const n = parseInt(text, 10);
    return Number.isNaN(n) ? min : n;
  };

  const handleChange = (e) => {
    const t = e.target.value;
    if (t === '') {
      setText('');
      return;
    }
    if (!/^\d+$/.test(t)) return;
    const n = parseInt(t, 10);
    if (n > max) return;
    setText(t);
    onChange(clamp(n));
  };

  const handleBlur = () => {
    if (text === '') {
      applyNumber(min);
      return;
    }
    const n = parseInt(text, 10);
    if (Number.isNaN(n) || n < min) {
      applyNumber(min);
      return;
    }
    applyNumber(n);
  };

  const step = (delta) => {
    applyNumber(currentNum() + delta);
  };

  const n = currentNum();

  return (
    <div className={`matching-people-count-input ${className}`.trim()}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="form-control matching-people-count-input__field"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onWheel={(e) => e.preventDefault()}
      />
      <div className="matching-people-count-input__btns" role="group" aria-label="Tăng giảm số">
        <button
          type="button"
          className="matching-people-count-input__btn"
          onClick={() => step(1)}
          disabled={n >= max}
          aria-label="Tăng 1"
        >
          <i className="feather-chevron-up" aria-hidden />
        </button>
        <button
          type="button"
          className="matching-people-count-input__btn"
          onClick={() => step(-1)}
          disabled={n <= min}
          aria-label="Giảm 1"
        >
          <i className="feather-chevron-down" aria-hidden />
        </button>
      </div>
    </div>
  );
}
