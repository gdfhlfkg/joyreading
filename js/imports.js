// 导入功能：文件选择、拖拽、剪贴板、文件夹快捷导入、EPUB/PDF解析

function setupDragDrop(containerId, onImport) {
  const container = document.getElementById(containerId);
  if (!container) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    container.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  container.addEventListener('dragover', () => {
    container.classList.add('drag-over');
  });

  container.addEventListener('dragleave', () => {
    container.classList.remove('drag-over');
  });

  container.addEventListener('drop', async (e) => {
    container.classList.remove('drag-over');
    const items = e.dataTransfer.items;
    if (!items) return;

    const entries = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          entries.push(entry);
        } else {
          entries.push(item.getAsFile());
        }
      }
    }

    if (entries.length > 0) {
      const files = await flattenEntries(entries);
      if (onImport) await onImport(files);
    }
  });
}

async function flattenEntries(entries) {
  const result = [];
  for (const entry of entries) {
    if (entry instanceof File) {
      result.push(entry);
    } else if (entry.isFile) {
      result.push(await getFile(entry));
    } else if (entry.isDirectory) {
      const dirFiles = await readDirectory(entry);
      result.push(...dirFiles);
    }
  }
  return result;
}

function getFile(entry) {
  return new Promise((resolve) => {
    entry.file(resolve);
  });
}

function readDirectory(dirEntry) {
  return new Promise((resolve) => {
    const reader = dirEntry.createReader();
    const files = [];
    const readBatch = () => {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve(files);
          return;
        }
        for (const entry of entries) {
          if (entry.isFile) {
            files.push(await getFile(entry));
          } else if (entry.isDirectory) {
            const subFiles = await readDirectory(entry);
            files.push(...subFiles);
          }
        }
        readBatch();
      });
    };
    readBatch();
  });
}

// 处理导入的文件列表（支持文件夹结构识别）
async function processImportedFiles(files) {
  const bookFolders = {};

  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    const parts = path.split('/');

    let folderName = '默认书籍';
    let fileName = file.name;

    if (parts.length >= 2) {
      folderName = parts[0];
      fileName = parts.slice(1).join('/');
    }

    if (!bookFolders[folderName]) {
      bookFolders[folderName] = { cover: null, content: [] };
    }

    const ext = fileName.toLowerCase().split('.').pop();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      bookFolders[folderName].cover = file;
    } else if (['txt', 'epub', 'pdf'].includes(ext)) {
      bookFolders[folderName].content.push(file);
    }
  }

  const results = [];
  for (const [folderName, assets] of Object.entries(bookFolders)) {
    let coverData = null;
    if (assets.cover) {
      coverData = await fileToDataURL(assets.cover);
    }

    for (const contentFile of assets.content) {
      const bookData = await parseBookFile(contentFile, coverData, folderName);
      if (bookData) results.push(bookData);
    }

    if (assets.content.length === 0 && assets.cover) {
      results.push({
        title: folderName,
        author: '',
        synopsis: '',
        tags: [],
        rating: 0,
        cover: coverData || '',
        chapters: [],
        volumes: [],
        source: 'folder-cover-only'
      });
    }
  }

  return results;
}

function fileToDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

async function parseBookFile(file, existingCover = null, folderName = '') {
  const ext = file.name.split('.').pop().toLowerCase();
  let result = null;

  if (ext === 'txt') {
    const text = await file.text();
    result = parseTXT(text);
  } else if (ext === 'epub') {
    result = await parseEPUB(file);
  } else if (ext === 'pdf') {
    result = await parsePDF(file);
  }

  if (!result) return null;

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return {
    title: folderName || baseName,
    author: '',
    synopsis: result.synopsis || '',
    tags: [],
    rating: 0,
    cover: existingCover || '',
    chapters: result.chapters,
    volumes: result.volumes,
    source: 'import'
  };
}

// TXT 解析（增强版：支持卷、章、简介提取）
function parseTXT(content) {
  const unified = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = unified.split('\n');
  const volumes = [];
  const chapters = [];
  let currentVolumeIndex = -1;
  let currentChapterTitle = '';
  let currentContent = [];
  let synopsis = '';
  let synopsisEnded = false;

  const volumeRegex = /^\s*(?:#{1,3}\s*)?(?:【?)(第[零一二三四五六七八九十百千\d]+卷)[：:\s]*(.*?)(?:】?)?\s*$/i;
  const chapterRegex = /^\s*(?:#{1,3}\s*)?(第[零一二三四五六七八九十百千\d]+章|Chapter\s+\d+|楔子|序章|尾声|番外)/i;
  const separatorRegex = /^\s*=+\s*$/;

  for (const line of lines) {
    if (!synopsisEnded && separatorRegex.test(line)) {
      synopsisEnded = true;
      continue;
    }
    if (!synopsisEnded) {
      synopsis += (synopsis ? '\n' : '') + line;
      continue;
    }

    const volMatch = line.match(volumeRegex);
    if (volMatch) {
      if (currentContent.length > 0) {
        chapters.push({
          title: currentChapterTitle,
          content: currentContent.join('\n'),
          volumeIndex: currentVolumeIndex
        });
        currentContent = [];
      }
      const volTitle = line.trim().replace(/^#+\s*/, '').replace(/^【/, '').replace(/】$/, '');
      currentVolumeIndex = volumes.length;
      volumes.push(volTitle);
      continue;
    }

    const chMatch = line.match(chapterRegex);
    if (chMatch) {
      if (currentContent.length > 0) {
        chapters.push({
          title: currentChapterTitle,
          content: currentContent.join('\n'),
          volumeIndex: currentVolumeIndex
        });
      }
      currentChapterTitle = line.trim().replace(/^#+\s*/, '');
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }

  if (currentContent.length > 0) {
    chapters.push({
      title: currentChapterTitle,
      content: currentContent.join('\n'),
      volumeIndex: currentVolumeIndex
    });
  }

  if (chapters.length === 0) {
    chapters.push({ title: '', content: unified, volumeIndex: -1 });
  }

  return { volumes, chapters, synopsis: synopsis.trim() };
}

// EPUB 解析
async function parseEPUB(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) throw new Error('无效的 EPUB 文件');

    const containerXml = await containerFile.async('string');
    const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!rootfileMatch) throw new Error('无法找到 EPUB 根文件');

    const rootfilePath = rootfileMatch[1];
    const opfFile = zip.file(rootfilePath);
    if (!opfFile) throw new Error('无法找到 OPF 文件');

    const opfXml = await opfFile.async('string');
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfXml, 'text/xml');

    const titleEl = opfDoc.querySelector('title');
    const title = titleEl ? titleEl.textContent.trim() : file.name.replace('.epub', '');

    const manifest = {};
    opfDoc.querySelectorAll('item').forEach(item => {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      if (id && href) {
        manifest[id] = href;
      }
    });

    const spineItems = opfDoc.querySelectorAll('itemref');
    const chapters = [];
    const basePath = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);

    for (const itemref of spineItems) {
      const idref = itemref.getAttribute('idref');
      const href = manifest[idref];
      if (!href) continue;

      const fullPath = basePath + href;
      const chapterFile = zip.file(fullPath);
      if (!chapterFile) continue;

      const htmlContent = await chapterFile.async('string');
      const chapterDoc = parser.parseFromString(htmlContent, 'text/html');

      const headings = chapterDoc.querySelectorAll('h1, h2, h3');
      let chapterTitle = '';
      if (headings.length > 0) {
        chapterTitle = headings[0].textContent.trim();
        headings[0].remove();
      }

      const bodyText = chapterDoc.body ? chapterDoc.body.textContent.trim() : chapterDoc.documentElement.textContent.trim();
      const cleanText = bodyText.replace(/\n{3,}/g, '\n\n');

      chapters.push({
        title: chapterTitle,
        content: cleanText,
        volumeIndex: -1
      });
    }

    return {
      title,
      chapters: chapters.length > 0 ? chapters : [{ title: '', content: '无法解析 EPUB 内容', volumeIndex: -1 }],
      volumes: [],
      synopsis: ''
    };
  } catch (err) {
    console.error('EPUB 解析错误:', err);
    return {
      chapters: [{ title: '', content: 'EPUB 解析失败：' + err.message, volumeIndex: -1 }],
      volumes: [],
      synopsis: ''
    };
  }
}

// PDF 解析
async function parsePDF(file) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/vendor/libs/pdfjs/pdf.worker.min.js';
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const chapters = [];
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    // 尝试按换行分割为段落，第一段作为标题
    const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim());
    if (paragraphs.length > 0) {
      const firstPara = paragraphs[0].trim();
      const title = firstPara.length > 50 ? firstPara.substring(0, 50) : firstPara;
      chapters.push({
        title: title,
        content: fullText.trim(),
        volumeIndex: -1
      });
    } else {
      chapters.push({
        title: '',
        content: fullText.trim(),
        volumeIndex: -1
      });
    }

    return {
      chapters,
      volumes: [],
      synopsis: ''
    };
  } catch (err) {
    console.error('PDF 解析错误:', err);
    return {
      chapters: [{ title: '', content: 'PDF 解析失败：' + err.message, volumeIndex: -1 }],
      volumes: [],
      synopsis: ''
    };
  }
}

// 剪贴板/URL 导入
async function importFromClipboard(text) {
  if (!text || !text.trim()) {
    showToast('剪贴板内容为空');
    return null;
  }

  // 检测是否为 URL
  if (/^https?:\/\/.+/.test(text.trim())) {
    try {
      const response = await fetch(text.trim());
      const content = await response.text();
      return parseTXT(content);
    } catch (err) {
      showToast('无法获取 URL 内容');
      return null;
    }
  }

  // 纯文本内容
  return parseTXT(text);
}

// 文件选择导入
function openFileSelector(callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.epub,.pdf';
  input.multiple = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && callback) {
      await callback(files);
    }
  };
  input.click();
}

// 文件夹选择导入
function openFolderSelector(callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;
  input.directory = true;
  input.multiple = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && callback) {
      await callback(files);
    }
  };
  input.click();
}