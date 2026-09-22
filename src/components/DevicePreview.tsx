import { useState } from 'react'
import { Monitor, Smartphone, Tablet } from 'lucide-react'

const devices = [
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900, icon: Monitor },
  { id: 'tablet', label: 'Tablet', width: 768, height: 1024, icon: Tablet },
  { id: 'mobile', label: 'Mobile', width: 390, height: 844, icon: Smartphone },
] as const

export function DevicePreview({
  src,
  original,
  processing,
}: {
  src: string
  original: boolean
  processing: boolean
}) {
  const [device, setDevice] = useState<(typeof devices)[number]>(devices[0])
  const [fit, setFit] = useState<'contain' | 'cover'>('cover')
  return (
    <section className="device-preview" aria-label="Device preview" aria-busy={processing}>
      <div className="device-preview-heading">
        <strong>Preview</strong>
        <div className="device-switch" role="group" aria-label="Preview device">
          {devices.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              type="button"
              aria-label={`${label} preview`}
              aria-pressed={device.id === id}
              title={`${label} preview`}
              onClick={() => setDevice(devices[index])}
            >
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <div className="device-switch device-fit-switch" role="group" aria-label="Preview image fit">
        <button
          type="button"
          aria-pressed={fit === 'contain'}
          title="Show the entire image"
          onClick={() => setFit('contain')}
        >
          Normal
        </button>
        <button
          type="button"
          aria-pressed={fit === 'cover'}
          title="Fill the screen with centered cropping"
          onClick={() => setFit('cover')}
        >
          Cover
        </button>
      </div>
      <div className="device-stage">
        <div className={`device-frame device-frame--${device.id}`}>
          <div
            className="device-screen"
            style={{ aspectRatio: `${device.width} / ${device.height}` }}
          >
            <img
              src={src}
              alt={`${original ? 'Original' : 'Optimized'} image in ${device.label.toLowerCase()} preview`}
              draggable={false}
              style={{ objectFit: fit }}
            />
          </div>
        </div>
      </div>
      <p className="device-caption" aria-live="polite">
        <strong>{device.label}</strong>
        <span>
          {device.width} × {device.height} viewport
        </span>
      </p>
      <p className="device-preview-note">Preview only. Export dimensions stay the same.</p>
    </section>
  )
}
