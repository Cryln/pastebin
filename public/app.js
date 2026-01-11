const $ = (id) => document.getElementById(id)

const i18n = {
  en: {
    language: 'Language',
    createPaste: 'Create paste',
    filename: 'Filename',
    expires: 'Expires',
    syntax: 'Syntax',
    mode: 'Mode',
    content: 'Content',
    file: 'File',
    create: 'Create',
    link: 'Link',
    raw: 'Raw',
    paste: 'Paste',
    download: 'Download',
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
    syntax: '语法',
    mode: '模式',
    content: '内容',
    file: '文件',
    create: '创建',
    link: '链接',
    raw: '原始',
    paste: '粘贴',
    download: '下载',
    uploading: '上传中...',
    loading: '加载中...',
    selectFile: '请选择文件',
    expired: '该内容已过期。',
    notFound: '未找到该内容。'
  }
}

let editor = null
let viewerEditor = null
let syntaxChoices = null
let langChoices = null

function currentLang() {
  try {
    return localStorage.getItem('lang') || (navigator.language.startsWith('zh') ? 'zh-CN' : 'en')
  } catch {
    return navigator.language.startsWith('zh') ? 'zh-CN' : 'en'
  }
}

function t(key) {
  const lang = currentLang()
  return (i18n[lang] && i18n[lang][key]) || i18n.en[key] || key
}

function setText(id, value) {
  const el = $(id)
  if (el) el.textContent = value
}

function applyI18n() {
  setText('langLabel', t('language'))
  setText('composeTitle', t('createPaste'))
  setText('filenameLabel', t('filename'))
  setText('expiresLabel', t('expires'))
  setText('syntaxLabel', t('syntax'))
  setText('modeLabel', t('mode'))
  setText('contentLabel', t('content'))
  setText('fileLabel', t('file'))
  setText('submit', t('create'))
  setText('linkLabel', t('link'))
  setText('rawLabel', t('raw'))
  setText('viewTitle', t('paste'))
  setText('downloadBtn', t('download'))
}

function show(el, on) {
  if (!el) return
  el.classList.toggle('hidden', !on)
}

function setStatus(target, msg) {
  if (!target) return
  target.textContent = msg || ''
}

function getPasteIdFromPath() {
  const m = location.pathname.match(/^\/p\/([^/]+)$/)
  return m ? m[1] : null
}

function languageFromFilename(filename) {
  const name = (filename || '').toLowerCase()
  const ext = name.includes('.') ? name.split('.').pop() : ''
  const map = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    html: 'htmlmixed',
    htm: 'htmlmixed',
    css: 'css',
    xml: 'xml',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell'
  }
  return map[ext] || ''
}

function ensureCodeMirror() {
  if (!window.CodeMirror) return false
  window.CodeMirror.modeURL =
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/%N/%N.min.js'
  return true
}

function applyMode(cm, lang) {
  if (!cm || !window.CodeMirror) return
  if (!lang) {
    cm.setOption('mode', null)
    return
  }

  const info = (window.CodeMirror.modeInfo || []).find((m) => m.mode === lang)
  if (info) {
    cm.setOption('mode', info.mime)
    window.CodeMirror.autoLoadMode(cm, info.mode)
    return
  }

  cm.setOption('mode', lang)
  window.CodeMirror.autoLoadMode(cm, lang)
}

function initChoices(selectEl, opts = {}) {
  if (!selectEl || !window.Choices) return null
  try {
    return new window.Choices(selectEl, {
      searchEnabled: true,
      shouldSort: false,
      itemSelectText: '',
      ...opts
    })
  } catch {
    return null
  }
}

async function createPaste() {
  const modeEl = $('mode')
  const filenameEl = $('filename')
  const syntaxEl = $('syntax')
  const expiresEl = $('expires')
  const statusEl = $('status')

  if (!modeEl || !filenameEl || !syntaxEl || !expiresEl) return

  const mode = modeEl.value
  const filename = filenameEl.value.trim() || 'snippet.txt'
  const language = syntaxEl.value || undefined
  const expiresInSeconds = expiresEl.value

  setStatus(statusEl, t('uploading'))
  show($('result'), false)

  let res
  if (mode === 'text') {
    const content = editor ? editor.getValue() : ($('content')?.value ?? '')
    res = await fetch('/api/paste', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, filename, language, expiresInSeconds })
    })
  } else {
    const fileInput = $('file')
    const file = fileInput && fileInput.files && fileInput.files[0]
    if (!file) {
      setStatus(statusEl, t('selectFile'))
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
    setStatus(statusEl, (body && body.error) || `Error ${res.status}`)
    return
  }

  const url = body.url
  const id = body.id
  const linkEl = $('resultLink')
  const rawEl = $('resultRaw')
  if (linkEl) {
    linkEl.textContent = url
    linkEl.href = url
  }
  if (rawEl) {
    rawEl.textContent = `/api/paste/${id}/raw`
    rawEl.href = `/api/paste/${id}/raw`
  }
  show($('result'), true)
  setStatus(statusEl, '')
}

async function loadPaste(id) {
  show($('compose'), false)
  show($('viewer'), true)
  if (viewerEditor) viewerEditor.refresh()
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
  const rawBtn = $('rawBtn')
  const downloadBtn = $('downloadBtn')
  if (rawBtn) rawBtn.href = rawUrl
  if (downloadBtn) downloadBtn.href = downloadUrl

  const viewMeta = $('viewMeta')
  if (viewMeta) {
    viewMeta.textContent = `${meta.filename} · ${Math.round(meta.sizeBytes / 1024)} KB${meta.expiresAt ? ` · expires ${new Date(meta.expiresAt).toLocaleString()}` : ''}`
  }

  const rawRes = await fetch(rawUrl)
  if (!rawRes.ok) {
    setStatus($('viewStatus'), `Error ${rawRes.status}`)
    return
  }

  const text = await rawRes.text()
  const lang = meta.language || languageFromFilename(meta.filename)

  if (viewerEditor) {
    viewerEditor.setValue(text)
    applyMode(viewerEditor, lang)
  }

  setStatus($('viewStatus'), '')
}

function initEditors() {
  if (!ensureCodeMirror()) return

  const content = $('content')
  const viewerText = $('viewerText')

  if (content) {
    editor = window.CodeMirror.fromTextArea(content, {
      lineNumbers: true,
      theme: 'material-darker',
      indentUnit: 2,
      tabSize: 2,
      viewportMargin: Infinity
    })
  }

  if (viewerText) {
    viewerEditor = window.CodeMirror.fromTextArea(viewerText, {
      lineNumbers: true,
      theme: 'material-darker',
      readOnly: true,
      viewportMargin: Infinity
    })
  }

  const syntaxEl = $('syntax')
  if (editor && syntaxEl) applyMode(editor, syntaxEl.value)
}

function bindComposeUI() {
  const submit = $('submit')
  const mode = $('mode')
  const syntax = $('syntax')
  const filename = $('filename')
  const file = $('file')

  if (submit) {
    submit.addEventListener('click', (e) => {
      e.preventDefault()
      createPaste().catch((err) => setStatus($('status'), String(err && err.message ? err.message : err)))
    })
  }

  if (mode) {
    mode.addEventListener('change', () => {
      const isText = mode.value === 'text'
      show($('textPane'), isText)
      show($('filePane'), !isText)
      if (editor) editor.refresh()
    })
  }

  if (syntax) {
    syntax.addEventListener('change', () => {
      if (editor) applyMode(editor, syntax.value)
    })
  }

  if (filename) {
    filename.addEventListener('input', () => {
      const guess = languageFromFilename(filename.value)
      if (guess && syntax && !syntax.value) {
        syntax.value = guess
        if (syntaxChoices) syntaxChoices.setChoiceByValue(guess)
      }
      if (editor && syntax) applyMode(editor, syntax.value)
    })
  }

  if (file) {
    file.addEventListener('change', () => {
      const f = file.files && file.files[0]
      if (!f) return
      if (filename && !filename.value.trim()) filename.value = f.name
      const guess = languageFromFilename(f.name)
      if (guess && syntax && !syntax.value) {
        syntax.value = guess
        if (syntaxChoices) syntaxChoices.setChoiceByValue(guess)
      }
    })
  }
}

function bindLangUI() {
  const sel = $('langSelect')
  if (!sel) return
  sel.value = currentLang()
  sel.addEventListener('change', () => {
    try {
      localStorage.setItem('lang', sel.value)
    } catch {
      // ignore
    }
    applyI18n()
  })
}

function init() {
  applyI18n()
  bindLangUI()

  syntaxChoices = initChoices($('syntax'))
  langChoices = initChoices($('langSelect'), { searchEnabled: false })
  void langChoices

  initEditors()
  bindComposeUI()

  const pasteId = getPasteIdFromPath()
  if (pasteId) {
    loadPaste(pasteId).catch((err) => setStatus($('viewStatus'), String(err && err.message ? err.message : err)))
  }
}

window.addEventListener('DOMContentLoaded', init)
