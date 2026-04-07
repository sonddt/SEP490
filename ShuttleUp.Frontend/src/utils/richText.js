/**
 * Rich text nhẹ: xuống dòng, **in đậm**, link http(s) tự động.
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} raw
 * @returns {string} HTML an toàn
 */
export function formatRichTextToHtml(raw) {
  if (raw == null || String(raw).trim() === '') return '';
  let t = escapeHtml(String(raw));
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\n/g, '<br />');
  t = t.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const safeText = url;
    let href = url;
    try {
      href = encodeURI(url);
    } catch {
      /* keep */
    }
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;color:#2563eb">${safeText}</a>`;
  });
  return t;
}
