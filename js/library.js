// 书架、推荐、搜索、书籍详情

let currentPage = 'home';
let currentDetailId = null;

// 更新搜索栏样式
function updateSearchBarStyle() {
  const wrapper = document.querySelector('.search-wrapper');
  if (!wrapper) return;
  wrapper.setAttribute('data-page', currentPage);
  const input = document.getElementById('searchInput');
  if (input) {
    const placeholders = {
      home: '搜索书名、作者或章节...',
      bookshelf: '搜索书架内的书籍...',
      admin: '搜索管理中的书籍...'
    };
    input.placeholder = placeholders[currentPage] || placeholders.home;
  }
}

// 切换页面
async function switchPage(page, data) {
  if (document.getElementById('readerOverlay')?.classList.contains('visible')) {
    await closeReader(true);
  }
  document.querySelectorAll('.page-view').forEach(v => {
    v.classList.remove('active', 'page-exit');
    v.classList.add('hidden');
  });
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.remove('hidden');
    requestAnimationFrame(() => target.classList.add('active'));
  }
  currentPage = page;
  updateNavActive(page);
  updateSearchBarStyle();
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    document.getElementById('clearSearch')?.classList.add('hidden');
  }
  if (page === 'home') renderHomeBooks();
  else if (page === 'bookshelf') renderBookshelf();
  else if (page === 'admin') renderAdmin();
  else if (page === 'detail' && data) showDetail(data);
  else if (page === 'import') renderImportPage();
  else if (page === 'bookmarks') renderBookmarksPage();
  else if (page === 'sync') renderSyncPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 更新导航激活状态
function updateNavActive(page) {
  document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
}

// 渲染推荐页面
async function renderHomeBooks(filter = '') {
  const grid = document.getElementById('bookGrid');
  const empty = document.getElementById('searchEmpty');
  if (!grid) return;
  let books = await db.novels.toArray();
  if (!filter) books.sort(() => Math.random() - 0.5);
  else {
    const f = filter.toLowerCase();
    books = books.filter(b =>
      b.title.toLowerCase().includes(f) ||
      b.author.toLowerCase().includes(f) ||
      (b.tags && b.tags.some(t => t.toLowerCase().includes(f))) ||
      (b.chapters && b.chapters.some(ch => ch.title && ch.title.toLowerCase().includes(f)))
    );
  }
  if (books.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  grid.innerHTML = books.map(b => `
    <div class="book-card" onclick="switchPage('detail', '${b.id}')">
      <div class="book-card-cover" style="${getCoverStyle(b)}">
        ${getCoverHTML(b)}
        ${b.rating ? `<span class="cover-rating">★ ${b.rating}</span>` : ''}
      </div>
      <div class="book-card-body">
        <div class="book-card-title">${escapeHtml(b.title)}</div>
        <div class="book-card-author">${escapeHtml(b.author)}</div>
        <div class="book-card-synopsis">${escapeHtml(b.synopsis || '')}</div>
        <div class="book-card-tags">${(b.tags || []).slice(0,3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
    </div>`).join('');
}

// 搜索处理
function handleSearch(val) {
  const query = val.trim().toLowerCase();
  document.getElementById('clearSearch')?.classList.toggle('hidden', !query);
  if (currentPage === 'bookshelf') renderBookshelf(query);
  else if (currentPage === 'admin') renderAdminBookList(query);
  else renderHomeBooks(query);
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  document.getElementById('clearSearch')?.classList.add('hidden');
  handleSearch('');
}

function shuffleBooks() {
  renderHomeBooks();
  showToast('已刷新推荐');
}

// 书籍详情
async function showDetail(id) {
  const book = await db.novels.get(id);
  if (!book) return;
  currentDetailId = id;
  const chapters = book.chapters || [];
  const progress = await db.progress.get(id);
  const container = document.getElementById('detailContent');
  if (!container) return;
  container.innerHTML = `
    <button class="btn-ghost" onclick="switchPage('home')" style="margin-bottom:16px;"><i class="fa-solid fa-arrow-left"></i> 返回</button>
    <div class="book-card" style="padding:32px;">
      <div style="display:flex; gap:32px; flex-wrap:wrap;">
        <div style="width:160px; flex-shrink:0;">
          <div class="book-card-cover" style="aspect-ratio:3/4; ${getCoverStyle(book)}">${getCoverHTML(book)}</div>
        </div>
        <div style="flex:1; min-width:200px;">
          <h1 style="font-size:36px; font-weight:700; color:var(--ink); margin:0;">${escapeHtml(book.title)}</h1>
          <p style="font-style:italic; color:var(--ink-secondary); margin-top:4px;">${escapeHtml(book.author)}</p>
          ${book.rating ? `<p style="color:var(--amber); font-weight:600; margin-top:8px;">★ ${book.rating}</p>` : ''}
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">${(book.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
          <p style="margin-top:24px; line-height:1.8; color:var(--ink);">${escapeHtml(book.synopsis)}</p>
          <div style="display:flex; gap:12px; margin-top:24px;">
            <button class="btn btn-primary" onclick="openReader('${book.id}')">${progress ? '继续阅读' : '开始阅读'}</button>
            <button class="btn btn-secondary" id="detailBookshelfBtn" onclick="toggleBookshelfFromDetail('${book.id}')">${book.addedToBookshelf ? '移出书架' : '加入书架'}</button>
          </div>
        </div>
      </div>
      <div style="margin-top:32px; border-top:1px solid var(--rule); padding-top:24px;">
        <h2 style="font-size:20px; font-weight:700; margin-bottom:16px;">目录 (${chapters.length}章)</h2>
        <div style="max-height:300px; overflow-y:auto;">
          ${chapters.map((ch,i) => `
            <div class="toc-item ${progress && progress.chapter===i ? 'active' : ''}" onclick="openReader('${book.id}',${i})">
              ${formatChapterTitle(i, ch)}
              ${progress && progress.chapter===i ? '<span style="font-size:11px; color:var(--ink-secondary); margin-left:8px;">上次读到</span>' : ''}
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

async function toggleBookshelfFromDetail(id) {
  const book = await db.novels.get(id);
  book.addedToBookshelf = book.addedToBookshelf ? 0 : 1;
  await db.novels.put(book);
  if (!book.addedToBookshelf) await db.progress.delete(id);
  showDetail(id);
  showToast(book.addedToBookshelf ? '已加入书架' : '已移出书架');
}

// 书架
async function renderBookshelf(filter = '') {
  const list = document.getElementById('bookshelfList');
  const empty = document.getElementById('bookshelfEmpty');
  if (!list) return;
  let books = await db.novels.where('addedToBookshelf').equals(1).toArray();
  if (filter) {
    const f = filter.toLowerCase();
    books = books.filter(b =>
      b.title.toLowerCase().includes(f) ||
      b.author.toLowerCase().includes(f) ||
      (b.tags && b.tags.some(t => t.toLowerCase().includes(f)))
    );
  }
  if (books.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  const progresses = await db.progress.bulkGet(books.map(b => b.id));
  list.innerHTML = books.map((b, i) => {
    const p = progresses[i];
    return `
      <div class="list-item" onclick="openReader('${b.id}')">
        <div class="list-item-cover" style="${getCoverStyle(b)}">${getCoverHTML(b, 'small')}</div>
        <div class="list-item-body">
          <div class="list-item-title">${escapeHtml(b.title)}</div>
          <div class="list-item-meta">${escapeHtml(b.author)}</div>
          ${p ? `<div class="list-item-progress">读至 ${formatChapterTitle(p.chapter, b.chapters[p.chapter] || {})}</div>` : '<div class="list-item-meta">未开始</div>'}
        </div>
        <button class="btn-icon" onclick="event.stopPropagation(); removeFromBookshelf('${b.id}')"><i class="fa-solid fa-trash-can"></i></button>
      </div>`;
  }).join('');
}

async function removeFromBookshelf(id) {
  const book = await db.novels.get(id);
  book.addedToBookshelf = 0;
  await db.novels.put(book);
  await db.progress.delete(id);
  renderBookshelf();
  showToast('已移出书架');
}

// 后台管理
async function renderAdmin() {
  const container = document.getElementById('adminContent');
  if (!container) return;
  const stored = await db.password.get('admin');
  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
      <h2 class="section-title">书籍管理</h2>
      <button class="btn btn-secondary" onclick="switchPage('import')"><i class="fa-solid fa-plus"></i> 导入新书</button>
    </div>
    <div id="adminBookList"></div>
    <div style="margin-top:32px;">
      <button class="btn-ghost" onclick="showChangePassword()"><i class="fa-solid fa-key"></i> 修改管理密码</button>
    </div>`;
  renderAdminBookList();
}

async function renderAdminBookList(filter = '') {
  let books = await db.novels.toArray();
  if (filter) {
    const f = filter.toLowerCase();
    books = books.filter(b => b.title.toLowerCase().includes(f) || b.author.toLowerCase().includes(f));
  }
  const list = document.getElementById('adminBookList');
  if (!list) return;
  list.innerHTML = books.map(b => `
    <div class="list-item">
      <div class="list-item-body">
        <div class="list-item-title">${escapeHtml(b.title)}</div>
        <div class="list-item-meta">${escapeHtml(b.author)} · ${(b.chapters||[]).length}章</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn-icon" onclick="openEditModalById('${b.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon" onclick="deleteBook('${b.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
}

async function openEditModalById(id) {
  const book = await db.novels.get(id);
  openEditModal(book);
}

async function deleteBook(id) {
  if (confirm('确定删除这本书吗？此操作不可恢复。')) {
    await db.novels.delete(id);
    await db.progress.delete(id);
    renderAdminBookList();
    showToast('已删除');
  }
}

async function showChangePassword() {
  const newPwd = prompt('请输入新密码（至少4位）');
  if (newPwd && newPwd.length >= 4) {
    await db.password.put({ key: 'admin', value: newPwd });
    showToast('密码已修改');
  } else if (newPwd) showToast('密码至少4位');
}

// 导入页面
function renderImportPage() {
  const container = document.getElementById('page-import');
  if (!container) return;
  container.innerHTML = `
    <h2 class="section-title" style="margin-bottom:24px;">导入书籍</h2>
    <div class="import-actions">
      <button class="btn btn-secondary" onclick="openFileSelector(handleImportedFiles)"><i class="fa-solid fa-file"></i> 选择文件</button>
      <button class="btn btn-secondary" onclick="openFolderSelector(handleImportedFiles)"><i class="fa-solid fa-folder-open"></i> 选择文件夹</button>
    </div>
    <div class="drop-zone" id="importDropZone">
      <div class="drop-zone-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
      <div class="drop-zone-text">拖拽文件或文件夹到此处</div>
      <div class="drop-zone-hint">支持 TXT、EPUB、PDF，封面图片请与书籍同名放在同一文件夹</div>
    </div>
    <textarea class="clipboard-area" id="clipboardInput" placeholder="粘贴文本内容或 URL 链接，按 Ctrl+Enter 导入"></textarea>
    <button class="btn btn-secondary mt-4" onclick="importFromClipboardArea()">从剪贴板导入</button>
    <div id="importResult" class="mt-4"></div>`;
  setupDragDrop('importDropZone', handleImportedFiles);
  document.getElementById('clipboardInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      importFromClipboardArea();
    }
  });
}

async function handleImportedFiles(files) {
  const results = await processImportedFiles(files);
  const resultDiv = document.getElementById('importResult');
  if (!resultDiv) return;
  let addedCount = 0;
  for (const bookData of results) {
    if (bookData.source === 'folder-cover-only') continue; // 仅有封面没有内容
    const id = Date.now().toString() + Math.random();
    await db.novels.put({
      id,
      title: bookData.title || '未命名',
      author: bookData.author || '',
      synopsis: bookData.synopsis || '',
      tags: bookData.tags || [],
      rating: bookData.rating || 0,
      cover: bookData.cover || '',
      chapters: bookData.chapters || [],
      volumes: bookData.volumes || [],
      addedToBookshelf: 0
    });
    addedCount++;
  }
  if (addedCount > 0) {
    showToast(`成功导入 ${addedCount} 本书籍`);
    resultDiv.innerHTML = `<p style="color:var(--sage);">成功导入 ${addedCount} 本书籍</p>`;
  } else {
    resultDiv.innerHTML = `<p style="color:var(--ink-secondary);">未识别到有效书籍</p>`;
  }
}

async function importFromClipboardArea() {
  const text = document.getElementById('clipboardInput')?.value;
  if (!text) return;
  const result = await importFromClipboard(text);
  if (result && result.chapters.length > 0) {
    const id = Date.now().toString() + Math.random();
    await db.novels.put({
      id,
      title: '导入文本',
      author: '',
      synopsis: result.synopsis || '',
      tags: [],
      rating: 0,
      cover: '',
      chapters: result.chapters,
      volumes: result.volumes || [],
      addedToBookshelf: 0
    });
    showToast('文本已导入');
    const resultDiv = document.getElementById('importResult');
    if (resultDiv) resultDiv.innerHTML = '<p style="color:var(--sage);">文本已成功导入</p>';
  } else {
    showToast('无法解析内容');
  }
}

// 书签页面
async function renderBookmarksPage() {
  const container = document.getElementById('page-bookmarks');
  if (!container) return;
  const allBookmarks = await db.bookmarks.toArray();
  const grouped = {};
  for (const bm of allBookmarks) {
    if (!grouped[bm.novelId]) grouped[bm.novelId] = { book: null, marks: [] };
    grouped[bm.novelId].marks.push(bm);
  }
  for (const novelId of Object.keys(grouped)) {
    grouped[novelId].book = await db.novels.get(novelId);
  }
  let html = '<h2 class="section-title" style="margin-bottom:24px;">我的书签</h2>';
  for (const [novelId, data] of Object.entries(grouped)) {
    if (!data.book) continue;
    html += `<h3 style="font-size:16px; font-weight:600; margin-top:24px; color:var(--amber);">${escapeHtml(data.book.title)}</h3>`;
    html += renderBookmarkList(data.marks, data.book.chapters || []);
  }
  if (!allBookmarks.length) {
    html += '<div class="empty-state"><div class="empty-state-text" style="font-style:italic;">暂无书签</div></div>';
  }
  container.innerHTML = html;
}

// 同步页面
function renderSyncPage() {
  const container = document.getElementById('page-sync');
  if (!container) return;
  container.innerHTML = `
    <h2 class="section-title" style="margin-bottom:24px;">数据同步</h2>
    <div style="display:flex; gap:12px; flex-wrap:wrap;">
      <button class="btn btn-secondary" onclick="exportData()"><i class="fa-solid fa-download"></i> 导出 JSON 备份</button>
      <button class="btn btn-secondary" onclick="triggerImportJson()"><i class="fa-solid fa-upload"></i> 从 JSON 恢复</button>
    </div>
    <div id="syncStatus" style="margin-top:16px; font-style:italic; color:var(--ink-secondary);"></div>`;
}

// 通用的模态框编辑（轻量版，复用之前 demo 的一些逻辑）
function openEditModal(book) {
  const container = document.getElementById('modalContainer');
  if (!container) return;
  const id = book ? book.id : null;
  container.innerHTML = `
    <div class="modal-overlay active" id="editModalOverlay">
      <div class="modal-box">
        <h3 class="modal-title">书籍信息</h3>
        <div class="form-group"><input type="text" id="editTitle" class="form-input" placeholder="书名" value="${escapeHtml(book?.title || '')}"></div>
        <div class="form-group"><input type="text" id="editAuthor" class="form-input" placeholder="作者" value="${escapeHtml(book?.author || '')}"></div>
        <div class="form-group"><textarea id="editSynopsis" class="form-input" placeholder="简介">${escapeHtml(book?.synopsis || '')}</textarea></div>
        <div class="form-group"><input type="text" id="editTags" class="form-input" placeholder="标签（逗号分隔）" value="${(book?.tags || []).join(',')}"></div>
        <div class="form-group"><input type="number" id="editRating" class="form-input" placeholder="评分 (0-10)" value="${book?.rating || ''}" step="0.1" min="0" max="10"></div>
        <div class="form-row">
          <label class="file-label"><i class="fa-solid fa-image"></i> 封面 <input type="file" accept="image/*" id="editCoverFile"></label>
          <span class="file-name" id="coverFileName">未选择文件</span>
        </div>
        <div class="form-row">
          <label class="file-label"><i class="fa-solid fa-file-lines"></i> 内容 <input type="file" accept=".txt,.epub,.pdf" id="editTxtFile"></label>
          <span class="file-name" id="txtFileName">未选择文件</span>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary" onclick="closeEditModal()">取消</button>
          <button class="btn btn-primary" id="saveEditBtn">保存</button>
        </div>
      </div>
    </div>`;
  document.getElementById('editCoverFile')?.addEventListener('change', function() {
    const name = this.files[0]?.name || '未选择文件';
    document.getElementById('coverFileName').textContent = name;
  });
  document.getElementById('editTxtFile')?.addEventListener('change', function() {
    const name = this.files[0]?.name || '未选择文件';
    document.getElementById('txtFileName').textContent = name;
  });
  document.getElementById('saveEditBtn')?.addEventListener('click', async () => {
    await saveEdit(id);
  });
  document.getElementById('editModalOverlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeEditModal();
  });
}

function closeEditModal() {
  document.getElementById('modalContainer').innerHTML = '';
}

async function saveEdit(bookId) {
  const title = document.getElementById('editTitle')?.value.trim();
  if (!title) { showToast('书名不能为空'); return; }
  const coverFile = document.getElementById('editCoverFile')?.files[0];
  let coverData = '';
  if (coverFile) {
    coverData = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(coverFile);
    });
  } else if (bookId) {
    const existing = await db.novels.get(bookId);
    coverData = existing?.cover || '';
  }

  const txtFile = document.getElementById('editTxtFile')?.files[0];
  let parsedChapters = [];
  let parsedVolumes = [];
  let parsedSynopsis = '';
  if (txtFile) {
    const ext = txtFile.name.split('.').pop().toLowerCase();
    if (ext === 'txt') {
      const text = await txtFile.text();
      const result = parseTXT(text);
      parsedChapters = result.chapters;
      parsedVolumes = result.volumes;
      parsedSynopsis = result.synopsis;
    } else if (ext === 'epub') {
      const result = await parseEPUB(txtFile);
      parsedChapters = result.chapters;
    } else if (ext === 'pdf') {
      const result = await parsePDF(txtFile);
      parsedChapters = result.chapters;
    }
  } else if (bookId) {
    const existing = await db.novels.get(bookId);
    parsedChapters = existing?.chapters || [];
    parsedVolumes = existing?.volumes || [];
  }

  const bookData = {
    id: bookId || Date.now().toString(),
    title,
    author: document.getElementById('editAuthor')?.value.trim() || '',
    synopsis: document.getElementById('editSynopsis')?.value.trim() || parsedSynopsis,
    tags: document.getElementById('editTags')?.value.split(',').map(t => t.trim()).filter(t => t) || [],
    rating: parseFloat(document.getElementById('editRating')?.value) || 0,
    cover: coverData,
    chapters: parsedChapters,
    volumes: parsedVolumes,
    addedToBookshelf: bookId ? (await db.novels.get(bookId))?.addedToBookshelf || 0 : 0
  };

  if (bookId) {
    await db.novels.update(bookId, bookData);
  } else {
    await db.novels.put(bookData);
  }
  closeEditModal();
  showToast('保存成功');
  if (currentPage === 'admin') renderAdminBookList();
  else if (currentPage === 'home') renderHomeBooks();
}

function escapeHtml(text) {
  return String(text || '').replace(/[&<>"]/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
  });
}