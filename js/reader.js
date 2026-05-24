// 阅读器核心
let currentReaderNovelId = null;
let chapters = [];
let volumes = [];
let renderedChapters = {};
let visibleChapterIndex = 0;
let isLoadingChapter = false;
let toolbarsVisible = true;
let currentSettings = { fontSize: 18, lineHeight: 1.85, paraSpacing: 1.8, bg: '#F2EFE9' };

async function openReader(novelId, chapterIdx = null) {
  const novel = await db.novels.get(novelId);
  if (!novel || !novel.chapters?.length) { showToast('书籍内容为空'); return; }
  const overlay = document.getElementById('readerOverlay');
  if (overlay.classList.contains('visible')) {
    currentReaderNovelId = novelId;
    chapters = novel.chapters;
    volumes = novel.volumes || [];
    const progress = await db.progress.get(novelId);
    const startChapter = chapterIdx !== null ? chapterIdx : (progress ? progress.chapter : 0);
    currentSettings = await loadSettings();
    document.getElementById('readerTitle').textContent = novel.title;
    updateBookshelfIcon(novel.addedToBookshelf);
    document.getElementById('readerParagraphs').innerHTML = '';
    renderedChapters = {};
    visibleChapterIndex = startChapter;
    await renderChapterIntoDOM(startChapter);
    document.getElementById('readerContent').scrollTop = progress ? progress.scroll : 0;
    updateChapterTitleFromScroll();
    updateProgressUI();
    updateReaderTime();
    updateSettingsUI();
    applyReaderStyles();
    return;
  }

  const activePage = document.querySelector('.page-view.active');
  if (activePage) {
    activePage.classList.add('page-exit');
    await new Promise(r => setTimeout(r, 150));
  }
  currentReaderNovelId = novelId;
  chapters = novel.chapters;
  volumes = novel.volumes || [];
  const progress = await db.progress.get(novelId);
  const startChapter = chapterIdx !== null ? chapterIdx : (progress ? progress.chapter : 0);
  currentSettings = await loadSettings();
  document.getElementById('readerTitle').textContent = novel.title;
  updateBookshelfIcon(novel.addedToBookshelf);
  document.getElementById('readerParagraphs').innerHTML = '';
  renderedChapters = {};
  visibleChapterIndex = startChapter;
  await renderChapterIntoDOM(startChapter);
  document.getElementById('readerContent').scrollTop = progress ? progress.scroll : 0;
  overlay.classList.add('visible');
  if (window.innerWidth < 768) document.querySelector('.bottom-nav')?.style.display = 'none';
  if (activePage) setTimeout(() => activePage.classList.remove('page-exit'), 200);
  updateChapterTitleFromScroll();
  updateProgressUI();
  updateReaderTime();
  updateSettingsUI();
  applyReaderStyles();
}

async function closeReader(animate = false) {
  if (currentReaderNovelId) await saveProgress();
  const overlay = document.getElementById('readerOverlay');
  document.querySelectorAll('.page-exit').forEach(el => el.classList.remove('page-exit'));
  if (!animate) { overlay.classList.remove('visible'); cleanupReader(); return; }
  overlay.classList.remove('visible');
  await new Promise(r => setTimeout(r, 200));
  if (!overlay.classList.contains('visible')) cleanupReader();
}

function cleanupReader() {
  currentReaderNovelId = null;
  renderedChapters = {};
  if (window.innerWidth < 768) document.querySelector('.bottom-nav')?.style.display = '';
}

async function saveProgress() {
  if (!currentReaderNovelId) return;
  const scroll = document.getElementById('readerContent').scrollTop;
  await db.progress.put({
    novelId: currentReaderNovelId,
    chapter: visibleChapterIndex,
    scroll,
    time: Date.now()
  });
}

function buildChapterHTML(index) {
  const ch = chapters[index];
  const title = formatChapterTitle(index, ch);
  const paragraphs = ch.content.split('\n').filter(p => p.trim());
  const pHTML = paragraphs.map(p => `<p style="margin-bottom:${currentSettings.paraSpacing}em; text-indent:2em;">${escapeHtml(p)}</p>`).join('');
  const volumeHTML = getVolumeTitleHTML(ch.volumeIndex);
  return `${volumeHTML}<div class="chapter-section" data-chapter="${index}"><h2 class="chapter-title">${title}</h2><div class="chapter-body">${pHTML}</div></div>`;
}

function getVolumeTitleHTML(volIndex) {
  if (volIndex < 0 || volIndex >= volumes.length) return '';
  const prevKeys = Object.keys(renderedChapters).map(Number);
  if (prevKeys.length === 0 || chapters[prevKeys[prevKeys.length - 1]]?.volumeIndex !== volIndex) {
    return `<div class="volume-title">${escapeHtml(volumes[volIndex])}</div>`;
  }
  return '';
}

async function renderChapterIntoDOM(index) {
  if (renderedChapters[index]) return;
  const container = document.getElementById('readerParagraphs');
  const html = buildChapterHTML(index);
  const keys = Object.keys(renderedChapters).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) container.innerHTML = html;
  else if (index < keys[0]) container.insertAdjacentHTML('afterbegin', html);
  else if (index > keys[keys.length - 1]) container.insertAdjacentHTML('beforeend', html);
  else {
    const beforeIdx = keys.find(k => k > index);
    const beforeEl = container.querySelector(`[data-chapter="${beforeIdx}"]`);
    if (beforeEl) beforeEl.insertAdjacentHTML('beforebegin', html);
    else container.insertAdjacentHTML('beforeend', html);
  }
  renderedChapters[index] = container.querySelector(`[data-chapter="${index}"]`);
  applyReaderStylesToChapter(renderedChapters[index]);
}

function applyReaderStylesToChapter(el) {
  if (!el) return;
  const ps = el.querySelectorAll('p');
  const isDark = isDarkBackground(currentSettings.bg);
  const color = isDark ? '#e0d7cc' : '#1B1B1B';
  ps.forEach(p => {
    p.style.fontSize = currentSettings.fontSize + 'px';
    p.style.lineHeight = currentSettings.lineHeight;
    p.style.marginBottom = currentSettings.paraSpacing + 'em';
    p.style.color = color;
  });
  const titleEl = el.querySelector('.chapter-title');
  if (titleEl) titleEl.style.color = color;
}

function applyReaderStyles() {
  const reader = document.getElementById('readerContent');
  reader.style.backgroundColor = currentSettings.bg;
  const isDark = isDarkBackground(currentSettings.bg);
  const toolbarBg = isDark ? '#2C241A' : '#F2EFE9';
  document.getElementById('readerToolbar').style.backgroundColor = toolbarBg;
  document.getElementById('readerBottombar').style.backgroundColor = toolbarBg;
  document.querySelectorAll('.chapter-section').forEach(el => applyReaderStylesToChapter(el));
}

function updateChapterTitleFromScroll() {
  const container = document.getElementById('readerContent');
  const scrollMid = container.scrollTop + container.clientHeight / 3;
  const divs = document.querySelectorAll('#readerParagraphs .chapter-section');
  let cur = 0;
  for (const div of divs) {
    if (div.offsetTop <= scrollMid) cur = parseInt(div.dataset.chapter);
    else break;
  }
  if (cur !== visibleChapterIndex) {
    visibleChapterIndex = cur;
    updateProgressUI();
  }
}

function updateProgressUI() {
  const pct = Math.round(((visibleChapterIndex + 1) / chapters.length) * 100);
  document.getElementById('readerProgress').textContent = pct + '%';
  document.getElementById('progressFill').style.width = pct + '%';
}

function updateBookshelfIcon(inShelf) {
  const icon = document.querySelector('#readerBookShelfBtn i');
  if (icon) icon.className = inShelf ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
}

async function toggleBookshelfFromReader() {
  if (!currentReaderNovelId) return;
  const book = await db.novels.get(currentReaderNovelId);
  book.addedToBookshelf = book.addedToBookshelf ? 0 : 1;
  await db.novels.put(book);
  if (!book.addedToBookshelf) await db.progress.delete(currentReaderNovelId);
  updateBookshelfIcon(book.addedToBookshelf);
  showToast(book.addedToBookshelf ? '已加入书架' : '已移出书架');
}

function updateReaderTime() {
  const now = new Date();
  const el = document.getElementById('readerTime');
  if (el) el.textContent = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}

// 设置面板
function openSettings() {
  document.getElementById('settingsPanel')?.classList.add('open');
  document.getElementById('settingsOverlay')?.classList.add('open');
  updateSettingsUI();
}

function closeSettings() {
  document.getElementById('settingsPanel')?.classList.remove('open');
  document.getElementById('settingsOverlay')?.classList.remove('open');
}

function updateSettingsUI() {
  document.getElementById('fontSizeSlider').value = currentSettings.fontSize;
  document.getElementById('lineHeightSlider').value = currentSettings.lineHeight;
  document.getElementById('paraSpacingSlider').value = currentSettings.paraSpacing;
  const swatches = document.getElementById('bgColorOptions');
  if (!swatches) return;
  swatches.innerHTML = ['#F2EFE9','#FAF8F4','#F5EED5','#E8F0E3','#2C241A','#1A1A1A'].map(c =>
    `<span class="color-swatch ${c===currentSettings.bg?'active':''}" style="background:${c}" onclick="currentSettings.bg='${c}';updateSettingsUI();applySettings();saveSettings(currentSettings)"></span>`
  ).join('');
}

function applySettings() {
  currentSettings.fontSize = parseInt(document.getElementById('fontSizeSlider').value);
  currentSettings.lineHeight = parseFloat(document.getElementById('lineHeightSlider').value);
  currentSettings.paraSpacing = parseFloat(document.getElementById('paraSpacingSlider').value);
  applyReaderStyles();
}

// 目录面板
function toggleTOC() {
  const panel = document.getElementById('tocPanel');
  const overlay = document.getElementById('tocOverlay');
  const isOpen = panel?.classList.toggle('open');
  overlay?.classList.toggle('open');
  if (isOpen) renderTOC();
}

function renderTOC() {
  const list = document.getElementById('tocList');
  if (!list) return;
  let html = '';
  let lastVol = -1;
  chapters.forEach((ch, i) => {
    if (volumes.length > 0 && ch.volumeIndex !== lastVol) {
      if (ch.volumeIndex >= 0 && ch.volumeIndex < volumes.length) {
        html += `<div class="toc-volume">${escapeHtml(volumes[ch.volumeIndex])}</div>`;
      }
      lastVol = ch.volumeIndex;
    }
    html += `<div class="toc-item ${i===visibleChapterIndex?'active':''}" onclick="jumpToChapter(${i})">${formatChapterTitle(i,ch)}</div>`;
  });
  list.innerHTML = html;
}

async function jumpToChapter(idx) {
  if (!renderedChapters[idx]) await renderChapterIntoDOM(idx);
  const el = document.querySelector(`[data-chapter="${idx}"]`);
  if (el) document.getElementById('readerContent').scrollTop = el.offsetTop - 80;
  toggleTOC();
}

// 事件绑定（在 app.js 初始化后调用）
function bindReaderEvents() {
  const readerEl = document.getElementById('readerContent');
  if (!readerEl) return;
  readerEl.addEventListener('scroll', () => {
    if (isLoadingChapter || !currentReaderNovelId) return;
    const el = readerEl, st = el.scrollTop, sh = el.scrollHeight, ch = el.clientHeight, threshold = 300;
    if (st + ch >= sh - threshold && visibleChapterIndex < chapters.length - 1) {
      const nextIdx = visibleChapterIndex + 1;
      if (!renderedChapters[nextIdx]) {
        isLoadingChapter = true;
        renderChapterIntoDOM(nextIdx).then(() => { isLoadingChapter = false; });
      }
    }
    if (st <= threshold && visibleChapterIndex > 0) {
      const prevIdx = visibleChapterIndex - 1;
      if (!renderedChapters[prevIdx]) {
        isLoadingChapter = true;
        const prevHeight = el.scrollHeight;
        renderChapterIntoDOM(prevIdx).then(() => {
          const added = el.scrollHeight - prevHeight;
          el.scrollTop = st + added;
          isLoadingChapter = false;
        });
      }
    }
    updateChapterTitleFromScroll();
  });

  readerEl.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
    toolbarsVisible = !toolbarsVisible;
    document.getElementById('readerToolbar')?.classList.toggle('hidden', !toolbarsVisible);
    document.getElementById('readerBottombar')?.classList.toggle('hidden', !toolbarsVisible);
  });

  document.getElementById('fontSizeSlider')?.addEventListener('input', applySettings);
  document.getElementById('lineHeightSlider')?.addEventListener('input', applySettings);
  document.getElementById('paraSpacingSlider')?.addEventListener('input', applySettings);
}

// 键盘事件（音量键翻页等）
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('readerOverlay')?.classList.contains('visible')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const content = document.getElementById('readerContent');
  if (!content) return;

  const keyCode = e.keyCode || e.which;
  if (keyCode === 175 || keyCode === 174) { // 音量键
    e.preventDefault();
    const amount = content.clientHeight * 0.8;
    content.scrollBy({ top: keyCode === 175 ? -amount : amount, behavior: 'smooth' });
    return;
  }
  switch(e.key) {
    case 'ArrowDown': case ' ': e.preventDefault(); content.scrollBy({top: 300, behavior: 'smooth'}); break;
    case 'ArrowUp': e.preventDefault(); content.scrollBy({top: -300, behavior: 'smooth'}); break;
    case 'PageDown': e.preventDefault(); content.scrollBy({top: content.clientHeight*0.9, behavior: 'smooth'}); break;
    case 'PageUp': e.preventDefault(); content.scrollBy({top: -content.clientHeight*0.9, behavior: 'smooth'}); break;
    case 't': e.preventDefault(); toggleTOC(); break;
    case 's': e.preventDefault(); openSettings(); break;
    case 'b': e.preventDefault(); toggleBookshelfFromReader(); break;
    case 'Escape': closeReader(true); break;
  }
});