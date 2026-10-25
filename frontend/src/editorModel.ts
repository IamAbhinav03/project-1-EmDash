import type { AssetMeta, Clip, Track } from './api'

export type AudioAsset = AssetMeta & { buffer: AudioBuffer }

const TRACK_COLORS = ['#969b9d', '#858b8e', '#a3a6a6', '#858b8e', '#969b9d', '#a3a6a6']

export const newId = () => crypto.randomUUID()

export const blankTrack = (name: string, index: number): Track => ({
  id: newId(),
  name,
  color: TRACK_COLORS[index % TRACK_COLORS.length],
  volume: 0.8,
  pan: 0,
  mute: false,
  solo: false,
  clips: [],
})

export const initialTracks = () => ['Vocals', 'Guitar', 'Bass', 'Drums', 'Keys', 'Ambient'].map(blankTrack)

export const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds || 0)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}.${String(Math.floor((safe % 1) * 1000)).padStart(3, '0')}`
}

export const cloneTracks = (tracks: Track[]) => tracks.map(track => ({
  ...track,
  clips: track.clips.map((clip: Clip) => ({ ...clip })),
}))
