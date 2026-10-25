import type { Clip } from './api'

export function trimLeft(clip: Clip, delta: number): Clip {
  const start = Math.max(0, clip.start - clip.offset, Math.min(clip.start + delta, clip.start + clip.duration - 0.08))
  return { ...clip, start, offset: clip.offset + start - clip.start, duration: clip.duration - (start - clip.start) }
}

export function trimRight(clip: Clip, delta: number, assetDuration: number): Clip {
  return { ...clip, duration: Math.max(0.08, Math.min(assetDuration - clip.offset, clip.duration + delta)) }
}

export function splitAt(clip: Clip, position: number, rightId: string): [Clip, Clip] | null {
  const relative = position - clip.start
  if (relative <= 0.03 || relative >= clip.duration - 0.03) return null
  return [
    { ...clip, duration: relative, fadeOut: 0 },
    { ...clip, id: rightId, start: position, duration: clip.duration - relative, offset: clip.offset + relative, fadeIn: 0 },
  ]
}
