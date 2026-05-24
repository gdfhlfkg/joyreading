// 数据同步（导出/导入 JSON）
async function exportData() {
  const novels = await db.novels.toArray();
  const progresses = await db.progress.toArray();
  const bookmarks = await db.bookmarks.toArray();
  const settings = await db.settings.toArray();
  const data = { novels, progresses, bookmarks, settings, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yuedu-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('备份已导出');
}

function triggerImportJson() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importData(data);
    } catch (err) {
      showToast('无效的备份文件');
    }
  };
  input.click();
}

async function importData(data) {
  if (!data.novels || !Array.isArray(data.novels)) {
    showToast('备份文件格式错误');
    return;
  }
  if (!confirm('将用备份数据覆盖当前数据，是否继续？')) return;
  await db.transaction('rw', db.novels, db.progress, db.bookmarks, db.settings, async () => {
    await db.novels.clear();
    await db.progress.clear();
    await db.bookmarks.clear();
    await db.settings.clear();
    await db.novels.bulkPut(data.novels);
    if (data.progresses) await db.progress.bulkPut(data.progresses);
    if (data.bookmarks) await db.bookmarks.bulkPut(data.bookmarks);
    if (data.settings) await db.settings.bulkPut(data.settings);
  });
  showToast('数据已恢复');
  switchPage('home');
}