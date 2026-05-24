// 工具函数
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), 2000);
}

function coverGradient(id) {
  const gradients = [
    '#A8583A 0%, #8E4628 100%',
    '#7A8470 0%, #5C6A52 100%',
    '#8B7355 0%, #6B5544 100%',
    '#C49B7A 0%, #A0785A 100%'
  ];
  return gradients[(parseInt(id) || 0) % gradients.length];
}

function getCoverStyle(book) {
  if (book.cover && book.cover.startsWith('data:image')) {
    return `background-image:url(${book.cover}); background-size:cover; background-position:center;`;
  }
  return `background: linear-gradient(145deg, ${coverGradient(book.id)});`;
}

function getCoverHTML(book, size = 'large') {
  if (book.cover && book.cover.startsWith('data:image')) {
    return '';
  }
  const title = book.title || '未命名';
  const displayTitle = title.length > 8 ? title.substring(0, 8) : title;
  const cls = size === 'small' ? 'cover-text-vertical-small' : 'cover-text-vertical';
  return `<span class="${cls}" style="font-family: var(--font-display); font-weight: 700; color: rgba(255,255,255,0.88); text-shadow: 0 1px 3px rgba(0,0,0,0.25); writing-mode: vertical-rl; letter-spacing: 0.25em;">${displayTitle}</span>`;
}

function isDarkBackground(bg) {
  const hex = bg.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16),
    g = parseInt(hex.substring(2, 4), 16),
    b = parseInt(hex.substring(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

function formatChapterTitle(index, chapter) {
  const base = `第${index + 1}章`;
  if (!chapter.title) return base;
  if (/^第[零一二三四五六七八九十百千\d]+章/.test(chapter.title)) return chapter.title;
  return `${base} ${chapter.title}`;
}