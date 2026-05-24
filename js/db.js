// 数据库定义
const db = new Dexie('YueDuDB');
db.version(2).stores({
  novels: 'id, title, author, synopsis, tags, rating, cover, chapters, volumes, addedToBookshelf',
  progress: 'novelId, chapter, scroll, time',
  settings: 'key',
  bookmarks: '++id, novelId, chapter, position, note, timestamp',
  password: 'key'
});

// 数据库默认设置
const defaultSettings = {
  fontSize: 18,
  lineHeight: 1.85,
  paraSpacing: 1.8,
  bg: '#F2EFE9'
};

async function loadSettings() {
  const s = await db.settings.get('reader');
  return s ? { ...defaultSettings, ...s.value } : { ...defaultSettings };
}

async function saveSettings(settings) {
  await db.settings.put({ key: 'reader', value: { ...settings } });
}