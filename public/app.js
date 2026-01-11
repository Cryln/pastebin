const $ = (id) => document.getElementById(id)

const i18n = {
  en: {
    language: 'Language',
    createPaste: 'Create paste',
    filename: 'Filename',
    expires: 'Expires',
    syntax: 'Syntax (optional)',
    mode: 'Mode',
    content: 'Content',
    file: 'File',
    create: 'Create',
    link: 'Link',
    raw: 'Raw',
    paste: 'Paste',
    download: 'Download',
    new: 'New',
    uploading: 'Uploading...',
    loading: 'Loading...',
    selectFile: 'Select a file',
    expired: 'This paste has expired.',
    notFound: 'Paste not found.'
  },
  'zh-CN': {
    language: '语言',
    createPaste: '新建粘贴',
    filename: '文件名',
    expires: '过期时间',
    syntax: '语法（可选）',
    mode: '模式',
    content: '内容',
    file: '文件',
    create: '创建',
    link: '链接',
    raw: '原始',
    paste: '粘贴',
    download: '下载',
    new: '新建',
    uploading: '上传中...',
    loading: '加载中...',
    selectFile: '请选择文件',
    expired: '该内容已过期。',
    notFound: '未找到该内容。'
  }
}

function currentLang() {
  return localStorage.getItem('lang') || (navigator.language.startsWith('zh') ? 'zh-CN' : 'en')
}

function t(key) {
  const lang = currentLang()
  return (i18n[lang] && i18n[lang][key]) || i18n.en[key] || key
}

function applyI18n() {
  $('langLabel').textContent = t('language')
  $('composeTitle').textContent = t('createPaste')
  $('filenameLabel').textContent = t('filename')
  $('expiresLabel').textContent = t('expires')
  $('syntaxLabel').textContent = t('syntax')
  $('modeLabel').textContent = t('mode')
  $('contentLabel').textContent = t('content')
  $('fileLabel').textContent = t('file')
  $('submit').textContent = t('create')
  $('linkLabel').textContent = t('link')
  $('rawLabel').textContent = t('raw')
  $('viewTitle').textContent = t('paste')
  $('downloadBtn').textContent = t('download')
}

function show(el, on) {
  el.classList.toggle('hidden', !on)
}

function setStatus(target, msg) {
  target.textContent = msg || ''
}

function getPasteIdFromPath() {
  const m = location.pathname.match(/^\/p\/([^/]+)$/)
  return m ? m[1] : null
}

async function createPaste() {
  const mode = $('mode').value
  const filename = $('filename').value.trim() || 'snippet.txt'
  const language = $('syntax').value.trim() || undefined
  const expiresInSeconds = $('expires').value

  setStatus($('status'), t('uploading'))
  show($('result'), false)

  let res
  if (mode === 'text') {
    const content = $('content').value
    res = await fetch('/api/paste', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, filename, language, expiresInSeconds })
    })
  } else {
    const file = $('file').files && $('file').files[0]
    if (!file) {
      setStatus($('status'), t('selectFile'))
      return
    }
    const form = new FormData()
    form.set('file', file)
    form.set('filename', filename)
    form.set('language', language || '')
    form.set('expiresInSeconds', expiresInSeconds)
    res = await fetch('/api/paste', { method: 'POST', body: form })
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    setStatus($('status'), (body && body.error) || `Error ${res.status}`)
    return
  }

  const url = body.url
  const id = body.id
  $('resultLink').textContent = url
  $('resultLink').href = url
  $('resultRaw').textContent = `/api/paste/${id}/raw`
  $('resultRaw').href = `/api/paste/${id}/raw`
  show($('result'), true)
  setStatus($('status'), '')
}

async function loadPaste(id) {
  show($('compose'), false)
  show($('viewer'), true)
  setStatus($('viewStatus'), t('loading'))

  const metaRes = await fetch(`/api/paste/${id}/meta`)
  if (metaRes.status === 404) {
    setStatus($('viewStatus'), t('notFound'))
    return
  }
  if (metaRes.status === 410) {
    setStatus($('viewStatus'), t('expired'))
    return
  }
  if (!metaRes.ok) {
    setStatus($('viewStatus'), `Error ${metaRes.status}`)
    return
  }

  const meta = await metaRes.json()
  const rawUrl = `/api/paste/${id}/raw`
  const downloadUrl = `/api/paste/${id}/download`
  $('rawBtn').href = rawUrl
  $('downloadBtn').href = downloadUrl
  $('viewMeta').textContent = `${meta.filename} · ${Math.round(meta.sizeBytes / 1024)} KB${meta.expiresAt ? ` · expires ${new Date(meta.expiresAt).toLocaleString()}` : ''}`

  const rawRes = await fetch(rawUrl)
  if (!rawRes.ok) {
    setStatus($('viewStatus'), `Error ${rawRes.status}`)
    return
  }
  const text = await rawRes.text()

  const code = $('codeBlock')
  code.className = ''
  if (meta.language) code.classList.add(`language-${meta.language}`)
  code.textContent = text

  try {
    if (window.hljs) window.hljs.highlightElement(code)
  } catch {
    // ignore
  }

  setStatus($('viewStatus'), '')
}

function bindComposeUI() {
  $('submit').addEventListener('click', (e) => {
    e.preventDefault()
    createPaste().catch((err) => setStatus($('status'), String(err && err.message ? err.message : err)))
  })

  $('mode').addEventListener('change', () => {
    const isText = $('mode').value === 'text'
    show($('textPane'), isText)
    show($('filePane'), !isText)
  })
}

function bindLangUI() {
  const sel = $('langSelect')
  sel.value = currentLang()
  sel.addEventListener('change', () => {
    localStorage.setItem('lang', sel.value)
    applyI18n()
  })
}

bindComposeUI()
bindLangUI()
applyI18n()

const pasteId = getPasteIdFromPath()
if (pasteId) {
  loadPaste(pasteId).catch((err) => setStatus($('viewStatus'), String(err && err.message ? err.message : err)))
}
