import { useCallback, useEffect, useRef, useState } from 'react'
import type { Format, Output, Settings, UploadedImage } from '../types'
import { friendlyError, loadFile, baseName } from '../utils/files'
import { detectFormats, initialSettings, processImage } from '../utils/processing'

export function useEditor() {
  const [image, setImage] = useState<UploadedImage | null>(null)
  const [history, setHistory] = useState<{ entries: Settings[]; index: number }>({
    entries: [],
    index: -1,
  })
  const [formats, setFormats] = useState<Format[]>(['image/jpeg', 'image/png'])
  const [output, setOutput] = useState<Output | null>(null)
  const [processing, setProcessing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('image-optimized')
  const sourceUrls = useRef(new Set<string>())
  const outputUrl = useRef('')
  const loadVersion = useRef(0)
  const loadController = useRef<AbortController | null>(null)
  const availableFormats = useRef(formats)
  const settings = history.entries[history.index] ?? null

  const openFile = useCallback(async (file: File, sample = false, scale = 2) => {
    const version = ++loadVersion.current
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    setLoading(true)
    setError('')
    try {
      const loaded = await loadFile(file, sample, { scale, signal: controller.signal })
      if (version !== loadVersion.current) {
        URL.revokeObjectURL(loaded.url)
        return
      }
      sourceUrls.current.forEach((url) => URL.revokeObjectURL(url))
      sourceUrls.current.clear()
      sourceUrls.current.add(loaded.url)
      if (outputUrl.current) URL.revokeObjectURL(outputUrl.current)
      outputUrl.current = ''
      setOutput(null)
      setImage(loaded)
      setFilename(`${baseName(file.name)}-optimized`)
      setHistory({ entries: [initialSettings(loaded, availableFormats.current)], index: 0 })
    } catch (error) {
      if (version === loadVersion.current && !controller.signal.aborted)
        setError(friendlyError(error))
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }, [])
  const cancelLoad = useCallback(() => {
    loadVersion.current++
    loadController.current?.abort()
    setLoading(false)
  }, [])

  useEffect(() => {
    let alive = true
    const initialVersion = loadVersion.current
    void (async () => {
      const supported = await detectFormats()
      if (!alive) return
      availableFormats.current = supported
      setFormats(supported)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}sample-landscape.jpg`)
        if (!response.ok) return
        const blob = await response.blob()
        if (alive && loadVersion.current === initialVersion)
          await openFile(new File([blob], 'alpine-escape.jpg', { type: 'image/jpeg' }), true)
      } catch {
        /* The upload area is available when the bundled sample is unavailable. */
      }
    })()
    return () => {
      alive = false
      loadVersion.current++
      loadController.current?.abort()
      sourceUrls.current.forEach(URL.revokeObjectURL)
      if (outputUrl.current) URL.revokeObjectURL(outputUrl.current)
    }
  }, [openFile])

  useEffect(() => {
    const retained = new Set(history.entries.map((entry) => entry.source.url))
    if (image) retained.add(image.url)
    for (const url of sourceUrls.current) {
      if (!retained.has(url)) {
        URL.revokeObjectURL(url)
        sourceUrls.current.delete(url)
      }
    }
  }, [history, image])

  const update = useCallback((patch: Partial<Settings>) => {
    setHistory((current) => {
      const previous = current.entries[current.index]
      if (
        !previous ||
        Object.entries(patch).every(([key, value]) => previous[key as keyof Settings] === value)
      )
        return current
      const entries = [
        ...current.entries.slice(0, current.index + 1),
        { ...previous, ...patch },
      ].slice(-50)
      return { entries, index: entries.length - 1 }
    })
  }, [])
  const undo = useCallback(() => setHistory((h) => ({ ...h, index: Math.max(0, h.index - 1) })), [])
  const redo = useCallback(
    () => setHistory((h) => ({ ...h, index: Math.min(h.entries.length - 1, h.index + 1) })),
    [],
  )
  const reset = useCallback(() => {
    if (image) update(initialSettings(image, availableFormats.current))
  }, [image, update])
  const applyCrop = useCallback(
    (blob: Blob, width: number, height: number) => {
      const url = URL.createObjectURL(blob)
      sourceUrls.current.add(url)
      update({
        source: { blob, url, width, height },
        width,
        height,
        rotation: 0,
        flipX: false,
        flipY: false,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        grayscale: false,
      })
    },
    [update],
  )

  useEffect(() => {
    if (!settings || !image) return
    const controller = new AbortController()
    setProcessing(true)
    setError('')
    const timer = setTimeout(async () => {
      try {
        const blob = await processImage(settings, image, controller.signal)
        if (controller.signal.aborted) return
        const url = URL.createObjectURL(blob)
        if (outputUrl.current) URL.revokeObjectURL(outputUrl.current)
        outputUrl.current = url
        setOutput({ blob, url, width: settings.width, height: settings.height })
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(friendlyError(error))
          setOutput(null)
        }
      } finally {
        if (!controller.signal.aborted) setProcessing(false)
      }
    }, 280)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [settings, image])

  return {
    image,
    settings,
    output,
    formats,
    processing,
    loading,
    error,
    setError,
    filename,
    setFilename,
    openFile,
    cancelLoad,
    update,
    undo,
    redo,
    reset,
    applyCrop,
    canUndo: history.index > 0,
    canRedo: history.index < history.entries.length - 1,
  }
}
export type Editor = ReturnType<typeof useEditor>
