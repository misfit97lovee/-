// Presentation only: escape HTML before applying a small, safe Markdown subset.
export function formatText(value) {
  const escaped = String(value ?? '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const inline = (text) => text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*/g, '');
  let list = '';
  const result = [];
  for (const line of escaped.split('\n')) {
    const item = line.match(/^\s*(?:[-*+]\s+|(\d+)[.)]\s+)(.*)$/);
    if (item) {
      const kind = item[1] ? 'ol' : 'ul';
      if (list !== kind) {
        if (list) result.push(`</${list}>`);
        list = kind;
        result.push(`<${list}>`);
      }
      result.push(`<li>${inline(item[2])}</li>`);
      continue;
    }
    if (list) { result.push(`</${list}>`); list = ''; }
    if (!line.trim()) continue;
    const heading = line.match(/^\s*#{1,6}\s+(.+)$/);
    result.push(heading ? `<h3>${inline(heading[1])}</h3>` : `<p>${inline(line)}</p>`);
  }
  if (list) result.push(`</${list}>`);
  return result.join('');
}
