const defaultFormat = (v) => {
  if (v == null || v === '') return '';
  return `${Number(v).toLocaleString('vi-VN')}đ`;
};

/** Giá sau giảm (nổi bật) + giá gốc gạch ngang khi có ưu đãi đơn đặt sân. */
export default function DiscountPriceDisplay({
  price,
  originalPrice,
  format = defaultFormat,
  primaryStyle,
  strikeStyle,
  layout = 'row',
}) {
  const p = price != null && price !== '' ? Number(price) : null;
  const o = originalPrice != null && originalPrice !== '' ? Number(originalPrice) : null;
  const showStrike = o != null && p != null && o > p + 0.5;

  if (p == null && o == null) return null;

  if (!showStrike) {
    const shown = format(p ?? o);
    if (!shown) return null;
    return <span style={primaryStyle}>{shown}</span>;
  }

  const flexDir = layout === 'block' ? 'column' : 'row';
  const align = layout === 'block' ? 'flex-end' : 'baseline';

  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: flexDir,
        alignItems: align,
        gap: layout === 'block' ? '2px' : '8px',
        flexWrap: layout === 'row' ? 'wrap' : 'nowrap',
        justifyContent: layout === 'block' ? 'flex-end' : undefined,
      }}
    >
      <span style={primaryStyle}>{format(p)}</span>
      <span
        style={{
          textDecoration: 'line-through',
          color: '#94a3b8',
          fontWeight: '600',
          fontSize: '0.82em',
          ...strikeStyle,
        }}
      >
        {format(o)}
      </span>
    </span>
  );
}
