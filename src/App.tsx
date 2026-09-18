import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Crop,
  Expand,
  FileImage,
  Heart,
  ImagePlus,
  Layers,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  Stamp,
  X,
  Zap,
  CircleHelp,
  RotateCcw,
  Keyboard,
  CheckCheck,
} from 'lucide-react'
import { ACCEPT, type Tab } from './types'
import { useEditor } from './hooks/useEditor'
import { Controls } from './components/Controls'
import { DownloadCard, Workspace, downloadEditor } from './components/Workspace'
import { Modal } from './components/Modal'
import './styles/app.css'
import './styles/theme.css'

const CropEditor = lazy(() => import('./features/CropEditor'))
const BatchOptimizer = lazy(() => import('./features/BatchOptimizer'))
const TABS = [
  { id: 'crop', icon: Crop, label: 'Crop' },
  { id: 'resize', icon: Expand, label: 'Resize' },
  { id: 'optimize', icon: SlidersHorizontal, label: 'Optimize' },
  { id: 'convert', icon: FileImage, label: 'Convert' },
  { id: 'adjust', icon: WandSparkles, label: 'Adjust' },
  { id: 'watermark', icon: Stamp, label: 'Watermark' },
] as const

function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        pixelwell<span className="brand-period">.</span>
      </span>
    </span>
  )
}
export default function App() {
  const editor = useEditor()
  const [mode, setMode] = useState<'editor' | 'batch'>('editor')
  const [tab, setTab] = useState<Tab>('optimize')
  const [cropOpen, setCropOpen] = useState(false)
  const [dialog, setDialog] = useState<'privacy' | 'help' | 'about' | null>(null)
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState('')
  const upload = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const choose = useCallback(() => upload.current?.click(), [])
  const notify = useCallback((message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 4200)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  useEffect(() => {
    if (editor.image?.vectorScale !== undefined) setTab('convert')
  }, [editor.image])
  const download = () => {
    if (downloadEditor(editor)) notify('Your image is ready. Download started!')
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (
        mode !== 'editor' ||
        (e.target as HTMLElement)?.matches?.('input,textarea,[contenteditable="true"]')
      )
        return
      const files = Array.from(e.clipboardData?.files || [])
      if (files.length) {
        e.preventDefault()
        void editor.openFile(files[0])
        if (files.length > 1)
          notify('Opened the first image. Use Batch optimizer for multiple files.')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.matches?.('input,textarea,select,[contenteditable="true"]') ||
        document.querySelector('dialog[open]')
      )
        return
      if ((e.metaKey || e.ctrlKey) && mode === 'editor') {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault()
          if (e.shiftKey) editor.redo()
          else editor.undo()
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault()
          editor.redo()
        }
        if (e.key.toLowerCase() === 's') {
          e.preventDefault()
          download()
        }
        if (e.key.toLowerCase() === 'o') {
          e.preventDefault()
          choose()
        }
      }
      if (e.key === '?') setDialog('help')
    }
    const preventFileNavigation = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKey)
    window.addEventListener('dragover', preventFileNavigation)
    window.addEventListener('drop', preventFileNavigation)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('dragover', preventFileNavigation)
      window.removeEventListener('drop', preventFileNavigation)
    }
  })
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to editor
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand-button"
            aria-label="Pixelwell home"
            onClick={() => setMode('editor')}
          >
            <Brand />
          </button>
          <nav className="main-nav" aria-label="Main navigation">
            <button className={mode === 'editor' ? 'active' : ''} onClick={() => setMode('editor')}>
              <SlidersHorizontal size={16} />
              Image editor
            </button>
            <button className={mode === 'batch' ? 'active' : ''} onClick={() => setMode('batch')}>
              <Layers size={16} />
              Batch optimizer<span className="nav-new">NEW</span>
            </button>
          </nav>
          <button className="header-privacy" onClick={() => setDialog('privacy')}>
            <ShieldCheck size={16} />
            <span>100% private. Always.</span>
            <ArrowUpRight size={13} />
          </button>
        </div>
      </header>
      <main id="main" className="main-container">
        <section className="page-heading">
          <div>
            <div className="eyebrow">
              <span />
              YOUR IMAGES. ONLY BETTER.
            </div>
            <h1>
              {mode === 'editor' ? (
                <>
                  A little lighter. <span>Just as beautiful.</span>
                </>
              ) : (
                <>
                  More images. <span>Less heavy lifting.</span>
                </>
              )}
            </h1>
            <p>
              {mode === 'editor'
                ? 'Crop, resize, and optimize your images. All in your browser. All yours.'
                : 'Optimize your whole collection with one simple setup. Privately, of course.'}
            </p>
          </div>
          {mode === 'editor' && (
            <button
              className="button primary upload-button"
              onClick={choose}
              disabled={editor.loading}
            >
              {editor.loading ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <ImagePlus size={18} />
              )}
              Choose image
            </button>
          )}
        </section>
        <input
          ref={upload}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose image file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void editor.openFile(file)
            e.target.value = ''
          }}
        />
        {mode === 'editor' ? (
          <>
            <div className="editor-meta">
              <span>
                <span className="live-indicator" />
                Your creative workspace
              </span>
              <button
                className="text-button"
                disabled={!editor.image || !editor.canUndo}
                onClick={() => {
                  editor.reset()
                  notify('Original image restored. You can undo this reset.')
                }}
              >
                <RotateCcw size={14} />
                Restore original
              </button>
            </div>
            <button className="vector-entry text-button" onClick={() => setTab('convert')}>
              <FileImage size={16} />
              SVG & EPS converter
              <ArrowUpRight size={14} />
            </button>
            {editor.loading && (
              <div className="import-status" role="status">
                <LoaderCircle size={18} className="spin" />
                <span>Opening your image… SVG and EPS artwork may take a moment.</span>
                <button className="text-button" onClick={editor.cancelLoad}>
                  Cancel import
                </button>
              </div>
            )}
            {editor.error && (
              <div className="error-banner" role="alert">
                {editor.error}
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => editor.setError('')}
                >
                  <X size={17} />
                </button>
              </div>
            )}
            {editor.image?.type === 'image/gif' && (
              <p className="animation-note">
                GIF images are exported as a still image. Animation is not preserved.
              </p>
            )}
            {editor.image &&
              ['image/webp', 'image/avif', 'image/png'].includes(editor.image.type) && (
                <span className="sr-only">Animated images export as a still frame.</span>
              )}
            <section
              className={`editor-layout ${dragging ? 'is-dragging' : ''}`}
              aria-label="Image editor"
              onDropCapture={() => {
                setDragging(false)
                dragDepth.current = 0
              }}
              onDragEnter={(e) => {
                if (e.dataTransfer.types.includes('Files')) {
                  e.preventDefault()
                  dragDepth.current++
                  setDragging(true)
                }
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                if (--dragDepth.current <= 0) {
                  setDragging(false)
                  dragDepth.current = 0
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                dragDepth.current = 0
                const files = Array.from(e.dataTransfer.files)
                if (files[0]) void editor.openFile(files[0])
                if (files.length > 1)
                  notify('Opened the first image. Switch to Batch optimizer to process them all.')
              }}
            >
              {dragging && (
                <div className="drop-overlay">
                  <ImagePlus size={36} />
                  <strong>Drop a little inspiration.</strong>
                  <span>Your image stays on your device.</span>
                </div>
              )}
              <div className="workspace-column">
                <Workspace editor={editor} onChoose={choose} onDownload={download} />
                <div className="under-preview">
                  <LockKeyhole size={13} />
                  <span>
                    Your images never leave your device.{' '}
                    <button onClick={() => setDialog('privacy')}>That’s a promise.</button>
                  </span>
                </div>
              </div>
              <aside className="editor-sidebar" aria-label="Editing controls">
                <div className="controls-card">
                  <div className="control-tabs" role="tablist" aria-label="Image editing tools">
                    {TABS.map((t) => (
                      <button
                        key={t.id}
                        id={`tab-${t.id}`}
                        role="tab"
                        aria-selected={tab === t.id}
                        aria-controls={`panel-${t.id}`}
                        tabIndex={tab === t.id ? 0 : -1}
                        className={tab === t.id ? 'active' : ''}
                        onKeyDown={(e) => {
                          const index = TABS.findIndex((t) => t.id === tab)
                          const next =
                            e.key === 'ArrowRight'
                              ? (index + 1) % TABS.length
                              : e.key === 'ArrowLeft'
                                ? (index + TABS.length - 1) % TABS.length
                                : e.key === 'Home'
                                  ? 0
                                  : e.key === 'End'
                                    ? TABS.length - 1
                                    : -1
                          if (next >= 0) {
                            e.preventDefault()
                            setTab(TABS[next].id)
                            document.getElementById(`tab-${TABS[next].id}`)?.focus()
                          }
                        }}
                        onClick={() => setTab(t.id)}
                      >
                        <t.icon size={18} strokeWidth={1.65} />
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                  <div
                    className="controls-body"
                    role="tabpanel"
                    id={`panel-${tab}`}
                    aria-labelledby={`tab-${tab}`}
                  >
                    {editor.settings ? (
                      <Controls editor={editor} tab={tab} onCrop={() => setCropOpen(true)} />
                    ) : (
                      <div className="controls-empty">
                        <SlidersHorizontal size={25} />
                        <p>Choose an image to make it your own.</p>
                        <button className="button secondary" onClick={choose}>
                          Choose image
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <DownloadCard editor={editor} onDownload={download} />
              </aside>
            </section>
          </>
        ) : (
          <Suspense
            fallback={
              <div className="feature-loading">
                <LoaderCircle size={23} className="spin" />
                Opening your batch workspace…
              </div>
            }
          >
            <BatchOptimizer formats={editor.formats} />
          </Suspense>
        )}
        <section className="benefits" aria-label="Why Pixelwell">
          <div>
            <span className="benefit-icon lavender">
              <ShieldCheck size={21} strokeWidth={1.6} />
            </span>
            <span>
              <strong>Private by design</strong>
              <p>Your files stay yours. Never uploaded.</p>
            </span>
          </div>
          <div>
            <span className="benefit-icon peach">
              <Zap size={21} strokeWidth={1.6} />
            </span>
            <span>
              <strong>Small files. Big possibilities.</strong>
              <p>Faster websites. Happier storage.</p>
            </span>
          </div>
          <div>
            <span className="benefit-icon mint">
              <CheckCheck size={21} strokeWidth={1.6} />
            </span>
            <span>
              <strong>Good quality comes standard</strong>
              <p>Keep the details. Lose the extra weight.</p>
            </span>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div>
          <Brand />
          <span>Thoughtfully simple. Beautifully useful.</span>
        </div>
        <div className="footer-links">
          <button onClick={() => setDialog('about')}>About</button>
          <button onClick={() => setDialog('privacy')}>Privacy</button>
          <button onClick={() => setDialog('help')}>
            <CircleHelp size={13} />
            Help & shortcuts
          </button>
          <span>
            Made for your pixels <Heart size={12} />
          </span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {cropOpen && editor.settings && (
        <Suspense
          fallback={
            <div className="modal-loading" role="status">
              <LoaderCircle className="spin" />
              Opening crop editor…
            </div>
          }
        >
          <CropEditor
            settings={editor.settings}
            onApply={editor.applyCrop}
            onClose={() => setCropOpen(false)}
          />
        </Suspense>
      )}
      {dialog && (
        <Modal
          title={
            dialog === 'privacy'
              ? 'Your images are your business.'
              : dialog === 'help'
                ? 'A few helpful little things.'
                : 'Meet Pixelwell.'
          }
          onClose={() => setDialog(null)}
        >
          <div className="info-modal">
            {dialog === 'privacy' ? (
              <>
                <span className="info-modal-icon">
                  <ShieldCheck size={30} />
                </span>
                <p>
                  Every crop, resize, and export happens locally in your browser. Your images are
                  never uploaded to a server.
                </p>
                <ul>
                  <li>We don’t store your images or send them to analytics.</li>
                  <li>EXIF, GPS, and camera metadata are removed by default.</li>
                  <li>Your working images are cleared when you close or reload this page.</li>
                  <li>No accounts, tracking cookies, or third-party scripts.</li>
                </ul>
                <p className="muted">
                  You can optionally preserve EXIF when converting JPG to JPG. This may include
                  location data. For other formats, metadata is always removed.
                </p>
              </>
            ) : dialog === 'help' ? (
              <>
                <p>
                  Drop a photo onto the editor, paste one from your clipboard, or choose a file to
                  get started. Preview changes automatically, then download when it looks just
                  right.
                </p>
                <h3>
                  <Keyboard size={17} />
                  Keyboard shortcuts
                </h3>
                <div className="shortcut-list">
                  {[
                    ['Choose an image', '⌘ / Ctrl + O'],
                    ['Save image', '⌘ / Ctrl + S'],
                    ['Undo', '⌘ / Ctrl + Z'],
                    ['Redo', '⌘ / Ctrl + Shift + Z'],
                    ['Paste image', '⌘ / Ctrl + V'],
                    ['Open help', '?'],
                  ].map(([label, key]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <kbd>{key}</kbd>
                    </div>
                  ))}
                </div>
                <h3>SVG & EPS conversion</h3>
                <p>
                  Use Convert to choose SVG or EPS artwork and an import resolution. Both support
                  the crop editor, resizing, adjustments, and watermarks. Export PNG, JPG, WebP, or
                  AVIF where supported. Vector imports become pixels; exports do not retain editable
                  vector paths. SVG must be static and self-contained. EPS fonts should be embedded;
                  missing fonts may be substituted.
                </p>
                <p>
                  EPS conversion uses Ghostscript locally.{' '}
                  <a
                    href={`${import.meta.env.BASE_URL}licenses/ghostscript-AGPL-3.0.txt`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    AGPL-3.0 license
                  </a>{' '}
                  ·{' '}
                  <a
                    href="https://github.com/alam00000/bentopdf-gs-wasm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Engine source and build instructions
                  </a>
                </p>
                <h3>Good to know</h3>
                <p>
                  Choose JPG, PNG, WebP, AVIF, GIF, BMP, SVG, or EPS files up to 50 MB and 40
                  megapixels. Animated files are exported as still images. Output is limited to
                  8,192 pixels per side and 24 megapixels.
                </p>
                <p>
                  PNG is lossless. WebP and AVIF exports depend on your browser’s encoder;
                  unavailable formats are disabled. JPG and JPEG are the same format, exported with
                  the .jpg extension.
                </p>
                <p>
                  Batch mode keeps image proportions, removes metadata, and can download up to 30
                  images as a ZIP. Crop changes become part of your undo history after you select
                  Apply crop.
                </p>
              </>
            ) : (
              <>
                <span className="info-modal-icon">
                  <Sparkles size={30} />
                </span>
                <p>
                  Pixelwell is a small, thoughtful workspace for better images. Less file weight, a
                  little more breathing room, and all the details that matter.
                </p>
                <p>
                  Built around your browser, so your creative work stays on your device. Free to
                  use, with no account required.
                </p>
                <a
                  className="external-link"
                  href="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b"
                  target="_blank"
                  rel="noreferrer"
                >
                  Sample photograph from Unsplash
                  <ArrowUpRight size={14} />
                </a>
              </>
            )}
            <button className="button primary full-width" onClick={() => setDialog(null)}>
              Back to your images
              <ChevronRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
