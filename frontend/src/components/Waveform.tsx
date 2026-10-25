import { useEffect, useRef } from 'react'
import type { Clip } from '../api'
import type { AudioAsset } from '../editorModel'

type WaveformProps = {
  asset: AudioAsset
  clip: Clip
  color: string
}

export function Waveform({ asset, clip, color }: WaveformProps) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvas.current
    if (!element) return

    const rect = element.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    if (!rect.width || !rect.height) return

    element.width = rect.width * ratio
    element.height = rect.height * ratio
    const context = element.getContext('2d')
    if (!context) return

    context.scale(ratio, ratio)
    const samples = asset.buffer.getChannelData(0)
    const start = Math.floor(clip.offset * asset.buffer.sampleRate)
    const length = Math.max(1, Math.floor(clip.duration * asset.buffer.sampleRate))
    const step = Math.max(1, Math.floor(length / rect.width))
    const middle = rect.height * 0.59
    const amplitude = rect.height * 0.36

    context.strokeStyle = color
    context.lineWidth = 1
    context.globalAlpha = 0.9
    context.beginPath()
    for (let x = 0; x < rect.width; x++) {
      let low = 1
      let high = -1
      for (let i = 0; i < step; i++) {
        const value = samples[Math.min(samples.length - 1, start + Math.floor(x * length / rect.width) + i)] || 0
        low = Math.min(low, value)
        high = Math.max(high, value)
      }
      context.moveTo(x + 0.5, middle - high * amplitude)
      context.lineTo(x + 0.5, middle - low * amplitude)
    }
    context.stroke()
  }, [asset, clip.duration, clip.offset, color])

  return <canvas ref={canvas} className="waveform" aria-hidden="true" />
}
