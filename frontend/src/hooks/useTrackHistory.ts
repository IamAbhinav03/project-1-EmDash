import { useCallback, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Track } from '../api'
import { cloneTracks } from '../editorModel'

type TrackHistory = { past: Track[][]; future: Track[][] }

export function useTrackHistory(
  tracksRef: { current: Track[] },
  setTracks: Dispatch<SetStateAction<Track[]>>,
  setSaved: Dispatch<SetStateAction<boolean>>,
) {
  const history = useRef<TrackHistory>({ past: [], future: [] })

  const commit = useCallback((next: Track[]) => {
    history.current.past.push(cloneTracks(tracksRef.current))
    if (history.current.past.length > 40) history.current.past.shift()
    history.current.future = []
    tracksRef.current = next
    setTracks(next)
    setSaved(false)
  }, [setSaved, setTracks, tracksRef])

  const undo = useCallback(() => {
    const previous = history.current.past.pop()
    if (!previous) return
    history.current.future.push(cloneTracks(tracksRef.current))
    const next = cloneTracks(previous)
    tracksRef.current = next
    setTracks(next)
    setSaved(false)
  }, [setSaved, setTracks, tracksRef])

  const redo = useCallback(() => {
    const nextHistory = history.current.future.pop()
    if (!nextHistory) return
    history.current.past.push(cloneTracks(tracksRef.current))
    const next = cloneTracks(nextHistory)
    tracksRef.current = next
    setTracks(next)
    setSaved(false)
  }, [setSaved, setTracks, tracksRef])

  const reset = useCallback(() => {
    history.current = { past: [], future: [] }
  }, [])

  return {
    history,
    commit,
    undo,
    redo,
    canUndo: history.current.past.length > 0,
    canRedo: history.current.future.length > 0,
    reset,
  }
}
