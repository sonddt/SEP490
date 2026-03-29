import { Fragment } from 'react';

const URL_RE = /(https?:\/\/[^\s]+)/gi;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyMentions(escapedPlain, members) {
  if (!members?.length) return escapedPlain;
  const sorted = [...members]
    .map((m) => String(m.fullName || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  let result = escapedPlain;
  for (const name of sorted) {
    const token = `@${escapeHtml(name)}`;
    if (!result.includes(token)) continue;
    const wrapped = `<span class="matching-mention">${token}</span>`;
    result = result.split(token).join(wrapped);
  }
  return result;
}

function lineToParts(line, members) {
  const chunks = line.split(URL_RE);
  return chunks.map((chunk, i) => {
    if (chunk.match(URL_RE)) {
      const safe = escapeHtml(chunk);
      return (
        <a key={i} href={chunk} target="_blank" rel="noopener noreferrer">
          {safe}
        </a>
      );
    }
    const html = applyMentions(escapeHtml(chunk), members);
    return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

/**
 * Hiển thị nội dung bình luận: xuống dòng, link URL, highlight @tên theo danh sách thành viên.
 */
export default function CommentRichText({ text, members = [] }) {
  if (text == null || text === '') return null;
  const lines = String(text).split('\n');
  return (
    <div className="matching-comment-rich-text">
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {lineToParts(line, members)}
        </Fragment>
      ))}
    </div>
  );
}
