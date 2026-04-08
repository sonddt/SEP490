import { formatRichTextToHtml } from '../../utils/richText';

/** Hiển thị nội dung rich text (xuống dòng, **đậm**, link). */
export default function RichText({ text, className = '', as: Tag = 'div' }) {
  if (text == null || String(text).trim() === '') return null;
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: formatRichTextToHtml(text) }}
    />
  );
}
