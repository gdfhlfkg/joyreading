// 书签管理
async function addBookmark(novelId, chapter, position, note = '') {
  const timestamp = Date.now();
  const id = await db.bookmarks.put({
    novelId,
    chapter,
    position,
    note,
    timestamp
  });
  return id;
}

async function removeBookmark(id) {
  await db.bookmarks.delete(id);
}

async function getBookmarks(novelId) {
  return await db.bookmarks.where('novelId').equals(novelId).toArray();
}

async function getChapterBookmarks(novelId, chapter) {
  return await db.bookmarks
    .where('novelId').equals(novelId)
    .and(b => b.chapter === chapter)
    .toArray();
}

async function getBookmarkAtPosition(novelId, chapter, position) {
  const marks = await db.bookmarks
    .where('novelId').equals(novelId)
    .and(b => b.chapter === chapter && Math.abs(b.position - position) < 50)
    .first();
  return marks || null;
}

function renderBookmarkList(bookmarks, chapters) {
  if (!bookmarks.length) {
    return '<div class="empty-state"><div class="empty-state-text" style="font-style: italic;">暂无书签</div></div>';
  }
  return bookmarks
    .sort((a, b) => a.chapter - b.chapter || a.position - b.position)
    .map(b => {
      const ch = chapters[b.chapter] || {};
      const chTitle = formatChapterTitle(b.chapter, ch);
      const date = new Date(b.timestamp).toLocaleDateString('zh-CN', {
        month: 'short', day: 'numeric'
      });
      return `
        <div class="list-item" onclick="jumpToBookmark('${b.novelId}', ${b.chapter}, ${b.position})">
          <div class="list-item-body">
            <div class="list-item-title">${chTitle}</div>
            <div class="list-item-meta">${date} · ${b.note || '无笔记'}</div>
          </div>
          <button class="btn-icon" onclick="event.stopPropagation(); deleteBookmark(${b.id})" title="删除书签">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>`;
    }).join('');
}

async function deleteBookmark(id) {
  await removeBookmark(id);
  showToast('书签已删除');
  if (typeof renderBookmarksPage === 'function') renderBookmarksPage();
}

async function jumpToBookmark(novelId, chapter, position) {
  if (typeof openReader === 'function') {
    await openReader(novelId, chapter);
    setTimeout(() => {
      const content = document.getElementById('readerContent');
      if (content) content.scrollTop = position;
    }, 300);
  }
}