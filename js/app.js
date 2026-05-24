// 入口、路由初始化、全局事件绑定
(async function init() {
  // 加载设置
  currentSettings = await loadSettings();

  // 初始化示例数据（如果数据库为空）
  if (await db.novels.count() === 0) {
    await db.novels.bulkPut([
      { id:'1', title:'三体', author:'刘慈欣', synopsis:'地球文明向宇宙发出的第一声啼鸣...', tags:['科幻','硬科幻'], rating:9.5, chapters:[{title:'疯狂年代',content:'中国，1967年。\n那是一个疯狂的年代。红色的旗帜在每一个角落飘扬...',volumeIndex:0},{title:'寂静的春天',content:'叶文洁第一次见到红岸基地时，被它的宏伟震撼了...',volumeIndex:0}], volumes:['第一卷'], addedToBookshelf:1 },
      { id:'2', title:'活着', author:'余华', synopsis:'一位中国农民的苦难一生...', tags:['现实主义'], rating:9.3, chapters:[{title:'',content:'我比现在年轻十岁的时候，获得了一个游手好闲的职业...',volumeIndex:-1}], volumes:[], addedToBookshelf:0 }
    ]);
  }

  // 构建 UI 框架
  buildSidebar();
  buildBottomNav();
  buildMainContent();

  // 绑定阅读器事件
  bindReaderEvents();

  // 切换首页
  switchPage('home');

  // 更新时间
  updateReaderTime();
  setInterval(updateReaderTime, 30000);

  // 响应窗口大小变化
  window.addEventListener('resize', () => {
    // 处理移动端与桌面端切换（如有需要可刷新UI）
  });
})();

function buildSidebar() {
  const aside = document.getElementById('sidebar');
  if (!aside) return;
  aside.innerHTML = `
    <div class="sidebar-brand">
      <div class="sidebar-brand-icon"><i class="fa-solid fa-book-open"></i></div>
      <span class="sidebar-brand-text">悦读</span>
    </div>
    <nav class="sidebar-nav">
      <a href="#" data-page="home" onclick="switchPage('home');return false;"><i class="fa-solid fa-compass"></i> 推荐</a>
      <a href="#" data-page="bookshelf" onclick="switchPage('bookshelf');return false;"><i class="fa-solid fa-bookmark"></i> 书架</a>
      <a href="#" data-page="bookmarks" onclick="switchPage('bookmarks');return false;"><i class="fa-solid fa-tag"></i> 书签</a>
      <a href="#" data-page="import" onclick="switchPage('import');return false;"><i class="fa-solid fa-file-import"></i> 导入</a>
      <a href="#" data-page="sync" onclick="switchPage('sync');return false;"><i class="fa-solid fa-cloud-arrow-up"></i> 同步</a>
      <a href="#" data-page="admin" onclick="switchPage('admin');return false;"><i class="fa-solid fa-gear"></i> 管理</a>
    </nav>
    <div class="sidebar-footer">轻量级 · 跨平台阅读</div>`;
}

function buildBottomNav() {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;
  nav.innerHTML = `
    <a href="#" data-page="home" onclick="switchPage('home');return false;"><i class="fa-solid fa-compass"></i><span>推荐</span></a>
    <a href="#" data-page="bookshelf" onclick="switchPage('bookshelf');return false;"><i class="fa-solid fa-bookmark"></i><span>书架</span></a>
    <a href="#" data-page="bookmarks" onclick="switchPage('bookmarks');return false;"><i class="fa-solid fa-tag"></i><span>书签</span></a>
    <a href="#" data-page="admin" onclick="switchPage('admin');return false;"><i class="fa-solid fa-gear"></i><span>管理</span></a>`;
}

function buildMainContent() {
  const main = document.getElementById('main');
  if (!main) return;
  main.innerHTML = `
    <div class="header-bar">
      <div class="header-inner">
        <div class="search-wrapper" data-page="home">
          <i class="fa-solid fa-magnifying-glass search-icon"></i>
          <input type="text" class="search-input" id="searchInput" placeholder="搜索书名、作者或章节..." oninput="handleSearch(this.value)">
          <button class="search-clear hidden" id="clearSearch" onclick="clearSearch()"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
    </div>
    <div class="content-area">
      <section id="page-home" class="page-view active">
        <div class="section-header"><h2 class="section-title">今日推荐</h2><button class="section-action" onclick="shuffleBooks()"><i class="fa-solid fa-shuffle"></i> 换一批</button></div>
        <div class="book-grid" id="bookGrid"></div>
        <div id="searchEmpty" class="empty-state hidden"><div class="empty-state-text">没有找到匹配的书籍</div></div>
      </section>
      <section id="page-bookshelf" class="page-view hidden">
        <h2 class="section-title" style="margin-bottom:24px;">我的书架</h2>
        <div id="bookshelfList"></div>
        <div id="bookshelfEmpty" class="empty-state hidden"><div class="empty-state-text">书架还是空的</div><a href="#" onclick="switchPage('home')" class="btn btn-secondary mt-4">去发现好书</a></div>
      </section>
      <section id="page-detail" class="page-view hidden"><div id="detailContent"></div></section>
      <section id="page-import" class="page-view hidden"></section>
      <section id="page-bookmarks" class="page-view hidden"></section>
      <section id="page-sync" class="page-view hidden"></section>
      <section id="page-admin" class="page-view hidden"><div id="adminContent"></div></section>
    </div>
    <!-- 阅读器面板 -->
    <div class="reader-overlay" id="readerOverlay">
      <div class="reader-toolbar" id="readerToolbar">
        <button class="btn-icon" onclick="closeReader(true)"><i class="fa-solid fa-arrow-left"></i></button>
        <span class="reader-title" id="readerTitle">书名</span>
        <button class="btn-icon" onclick="toggleTOC()"><i class="fa-solid fa-list-ul"></i></button>
      </div>
      <div class="reader-content" id="readerContent">
        <div class="reader-inner" id="readerInner">
          <div id="readerParagraphs"></div>
        </div>
      </div>
      <div class="reader-bottombar" id="readerBottombar">
        <div><span class="reader-progress" id="readerProgress">0%</span><div class="progress-bar" style="width:80px; margin-top:4px;"><div class="progress-bar-fill" id="progressFill" style="width:0;"></div></div></div>
        <div style="display:flex; gap:16px;">
          <button class="btn-icon" onclick="openSettings()"><i class="fa-solid fa-text-height"></i></button>
          <button class="btn-icon" id="readerBookShelfBtn" onclick="toggleBookshelfFromReader()"><i class="fa-regular fa-bookmark"></i></button>
        </div>
        <span class="reader-time" id="readerTime">--:--</span>
      </div>
      <!-- 目录面板 -->
      <div class="panel-right" id="tocPanel">
        <div class="panel-header"><h3 class="panel-title">目录</h3><button class="btn-icon" onclick="toggleTOC()"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="panel-body" id="tocList"></div>
      </div>
      <div class="panel-overlay" id="tocOverlay" onclick="toggleTOC()"></div>
      <!-- 设置面板 -->
      <div class="panel-bottom" id="settingsPanel">
        <div class="panel-header"><h3 class="panel-title">阅读设置</h3><button class="btn-icon" onclick="closeSettings()"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="panel-body">
          <div class="setting-row"><label class="setting-label">字体大小</label><input type="range" min="14" max="28" value="18" class="setting-slider" id="fontSizeSlider"></div>
          <div class="setting-row"><label class="setting-label">行高</label><input type="range" min="1.2" max="3.0" step="0.05" value="1.85" class="setting-slider" id="lineHeightSlider"></div>
          <div class="setting-row"><label class="setting-label">段间距</label><input type="range" min="0.5" max="4.0" step="0.1" value="1.8" class="setting-slider" id="paraSpacingSlider"></div>
          <div class="setting-row"><label class="setting-label">背景色</label><div class="color-swatches" id="bgColorOptions"></div></div>
        </div>
      </div>
      <div class="panel-overlay" id="settingsOverlay" onclick="closeSettings()"></div>
    </div>
    <!-- 模态框容器 -->
    <div id="modalContainer"></div>`;
}