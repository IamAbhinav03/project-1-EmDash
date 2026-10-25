import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { AudioLines, FileAudio, FolderOpen, Import, SlidersHorizontal, X } from 'lucide-react'
import type { Clip, SavedProject, Track } from './api'
import { encodeWav } from './audio'
import { splitAt, trimLeft, trimRight } from './clipEditing'
import { TransportBar } from './components/TransportBar'
import { InspectorPanel, type InspectorTab } from './components/InspectorPanel'
import { TimelineEditor } from './components/TimelineEditor'
import { useTrackHistory } from './hooks/useTrackHistory'
import { useProjectManager } from './hooks/useProjectManager'
import { blankTrack, cloneTracks, initialTracks, newId, type AudioAsset } from './editorModel'

export default function App() {
  const [projectId, setProjectId] = useState<string>(newId())
  const [projectName, setProjectName] = useState('Untitled session')
  const [tracks, setTracks] = useState<Track[]>(initialTracks)
  const [assets, setAssets] = useState<AudioAsset[]>([])
  const [position, setPosition] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [selected, setSelected] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loop] = useState(false)
  const [scrollX, setScrollX] = useState(0)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('Inspector')
  const [mediaOpen, setMediaOpen] = useState(false)
  const [saved, setSaved] = useState(true)
  const [toast, setToast] = useState('')
  const [projectList, setProjectList] = useState<Array<Pick<SavedProject, 'id' | 'name' | 'updatedAt'>> | null>(null)
  const [busyExport, setBusyExport] = useState(false)
  const audioContext = useRef<AudioContext | null>(null)
  const playback = useRef({ active: false, offset: 0, startAt: 0, raf: 0 })
  const scheduledSources = useRef(new Set<AudioBufferSourceNode>())
  const tracksRef = useRef(tracks)
  const positionRef = useRef(position)
  const { history, commit, undo, redo, canUndo: undoAvailable, canRedo: redoAvailable, reset: resetHistory } = useTrackHistory(tracksRef, setTracks, setSaved)
  const pps = zoom
  const total = useMemo(() => Math.max(0, ...tracks.flatMap(track => track.clips.map(clip => clip.start + clip.duration))), [tracks])
  const selectedClip = tracks.flatMap(track => track.clips.map(clip => ({ track, clip }))).find(item => item.clip.id === selected)
  const showToast = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2300) }, [])

  useEffect(() => { tracksRef.current = tracks }, [tracks])
  useEffect(() => { positionRef.current = position }, [position])
  useEffect(() => {
    if (positionRef.current > total) { positionRef.current = total; setPosition(total) }
  }, [total])
  useEffect(() => { setSaved(true) }, [])
  const getAudioContext = useCallback(async () => {
    if (!audioContext.current) audioContext.current = new AudioContext()
    if (audioContext.current.state === 'suspended') await audioContext.current.resume()
    return audioContext.current
  }, [])
  const { importFiles, importProgress, saveProject, openProject, showProjects } = useProjectManager({
    projectId, projectName, tracksRef, assets, getAudioContext, showToast,
    setAssets, setProjectId, setProjectName, setTracks, setPosition, setSelected,
    setProjectList, setSaved, resetHistory,
  })
  const patchClip = (id: string, updater: (clip: Clip) => Clip) => setTracks(current => {
    const next = current.map(track => ({ ...track, clips: track.clips.map(clip => clip.id === id ? updater(clip) : clip) }))
    tracksRef.current = next
    return next
  })
  const finishPointerEdit = (before: Track[]) => {
    history.current.past.push(before); history.current.future = []
    setTracks(current => { tracksRef.current = current; return [...current] }); setSaved(false)
  }
  const dragClip = (event: ReactPointerEvent<HTMLDivElement>, clip: Clip) => {
    if ((event.target as HTMLElement).dataset.edge) return
    const element = event.currentTarget, before = cloneTracks(tracksRef.current), origin = event.clientX, initial = clip.start
    element.setPointerCapture(event.pointerId)
    const move = (moveEvent: PointerEvent) => patchClip(clip.id, item => ({ ...item, start: Math.max(0, initial + (moveEvent.clientX - origin) / pps) }))
    const end = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', end); finishPointerEdit(before) }
    element.addEventListener('pointermove', move); element.addEventListener('pointerup', end)
  }
  const trimClip = (event: ReactPointerEvent<HTMLElement>, clip: Clip, side: 'left' | 'right') => {
    event.stopPropagation()
    const element = event.currentTarget, before = cloneTracks(tracksRef.current), origin = event.clientX
    element.setPointerCapture(event.pointerId)
    if (side === 'left') {
      const move = (moveEvent: PointerEvent) => {
        const delta = (moveEvent.clientX - origin) / pps
        patchClip(clip.id, () => trimLeft(clip, delta))
      }
      const end = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', end); finishPointerEdit(before) }
      element.addEventListener('pointermove', move); element.addEventListener('pointerup', end)
    } else {
      const assetDuration = assets.find(asset => asset.id === clip.assetId)?.buffer.duration ?? clip.duration + clip.offset
      const move = (moveEvent: PointerEvent) => patchClip(clip.id, () => trimRight(clip, (moveEvent.clientX - origin) / pps, assetDuration))
      const end = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', end); finishPointerEdit(before) }
      element.addEventListener('pointermove', move); element.addEventListener('pointerup', end)
    }
  }

  const addTrack = () => { commit([...cloneTracks(tracksRef.current), blankTrack(`Track ${tracksRef.current.length + 1}`, tracksRef.current.length)]) }
  const stopPlayback = useCallback(() => {
    playback.current.active = false; cancelAnimationFrame(playback.current.raf); setPlaying(false)
    scheduledSources.current.forEach(source => { try { source.stop() } catch { /* Source already ended. */ } })
    scheduledSources.current.clear()
  }, [])
  useEffect(() => {
    if (!playback.current.active || !audioContext.current) return
    const current = Math.min(total, playback.current.offset + audioContext.current.currentTime - playback.current.startAt)
    positionRef.current = current
    setPosition(current)
    stopPlayback()
  }, [tracks, total, stopPlayback])
  const schedule = useCallback((from: number, context: AudioContext) => {
    const now = context.currentTime, currentTracks = tracksRef.current, hasSolo = currentTracks.some(track => track.solo)
    currentTracks.forEach(track => {
      if (track.mute || (hasSolo && !track.solo)) return
      track.clips.forEach(clip => {
        const end = clip.start + clip.duration
        if (end <= from) return
        const asset = assets.find(item => item.id === clip.assetId)
        if (!asset) return
        const delta = Math.max(0, from - clip.start), duration = end - Math.max(from, clip.start)
        const source = context.createBufferSource(), gain = context.createGain(), pan = context.createStereoPanner()
        source.buffer = asset.buffer; gain.gain.value = track.volume; pan.pan.value = track.pan ?? 0
        const when = now + Math.max(0, clip.start - from), fadeIn = Math.max(0, clip.fadeIn - delta)
        gain.gain.setValueAtTime(track.volume, when)
        if (fadeIn > 0) { gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(track.volume, when + Math.min(fadeIn, duration)) }
        if (clip.fadeOut > 0) {
          if (duration > clip.fadeOut) gain.gain.setValueAtTime(track.volume, when + duration - clip.fadeOut)
          gain.gain.linearRampToValueAtTime(0, when + duration)
        }
        source.connect(gain).connect(pan).connect(context.destination)
        source.onended = () => scheduledSources.current.delete(source)
        scheduledSources.current.add(source)
        source.start(when, clip.offset + delta, duration)
      })
    })
  }, [assets])
  const play = async () => {
    if (playback.current.active) { const current = playback.current.offset + (audioContext.current!.currentTime - playback.current.startAt); positionRef.current = current; setPosition(current); stopPlayback(); return }
    if (!total) { showToast('Import audio to start playback'); return }
    const context = await getAudioContext(); playback.current = { active: true, offset: positionRef.current, startAt: context.currentTime, raf: 0 }
    schedule(positionRef.current, context); setPlaying(true)
    const tick = () => {
      if (!playback.current.active) return
      let next = playback.current.offset + (context.currentTime - playback.current.startAt)
      if (next >= total) {
        if (loop) { playback.current.offset = 0; playback.current.startAt = context.currentTime; schedule(0, context); next = 0 }
        else { setPosition(total); stopPlayback(); return }
      }
      setPosition(next); playback.current.raf = requestAnimationFrame(tick)
    }
    playback.current.raf = requestAnimationFrame(tick)
  }
  const seek = (seconds: number) => {
    const next = Math.max(0, Math.min(total, seconds)); setPosition(next)
    if (playback.current.active) { stopPlayback(); window.setTimeout(() => { positionRef.current = next; void play() }, 0) }
  }
  const removeClip = () => {
    if (!selected) return
    commit(tracksRef.current.map(track => ({ ...track, clips: track.clips.filter(clip => clip.id !== selected) }))); setSelected(null)
  }
  const splitClip = () => {
    if (!selectedClip) return
    const { clip, track } = selectedClip, halves = splitAt(clip, position, newId())
    if (!halves) { showToast('Place the playhead inside the selected clip'); return }
    const next = cloneTracks(tracksRef.current), target = next.find(item => item.id === track.id)!, index = target.clips.findIndex(item => item.id === clip.id)
    target.clips[index] = halves[0]; target.clips.push(halves[1]); commit(next); setSelected(halves[1].id)
  }
  const setFade = (kind: 'fadeIn' | 'fadeOut') => {
    if (!selectedClip) return
    const value = window.prompt(`Fade ${kind === 'fadeIn' ? 'in' : 'out'} in seconds (0 to ${selectedClip.clip.duration.toFixed(2)})`, String(selectedClip.clip[kind] || 0.5))
    if (value === null) return
    const seconds = Number(value)
    if (!Number.isFinite(seconds) || seconds < 0) { showToast('Enter a valid fade duration'); return }
    commit(tracksRef.current.map(track => ({ ...track, clips: track.clips.map(clip => clip.id === selected ? { ...clip, [kind]: Math.min(clip.duration, seconds) } : clip) })))
  }
  const exportMix = async () => {
    if (!total) { showToast('Add audio to the timeline before exporting'); return }
    setBusyExport(true)
    try {
      const rate = audioContext.current?.sampleRate ?? 44100
      const offline = new OfflineAudioContext(2, Math.ceil(total * rate), rate), hasSolo = tracks.some(track => track.solo)
      tracks.forEach(track => {
        if (track.mute || (hasSolo && !track.solo)) return
        track.clips.forEach(clip => {
          const asset = assets.find(item => item.id === clip.assetId); if (!asset) return
          const source = offline.createBufferSource(), gain = offline.createGain(), pan = offline.createStereoPanner(); source.buffer = asset.buffer; pan.pan.value = track.pan ?? 0
          gain.gain.value = track.volume
          if (clip.fadeIn) { gain.gain.setValueAtTime(0, clip.start); gain.gain.linearRampToValueAtTime(track.volume, clip.start + clip.fadeIn) }
          if (clip.fadeOut) { gain.gain.setValueAtTime(track.volume, Math.max(clip.start, clip.start + clip.duration - clip.fadeOut)); gain.gain.linearRampToValueAtTime(0, clip.start + clip.duration) }
          source.connect(gain).connect(pan).connect(offline.destination); source.start(clip.start, clip.offset, clip.duration)
        })
      })
      const blob = encodeWav(await offline.startRendering()), url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = `${projectName.replace(/[^a-z0-9-_]+/gi, '_') || 'emdash-mix'}.wav`; link.click(); URL.revokeObjectURL(url); showToast('WAV mix exported')
    } catch { showToast('Export failed. Try a shorter session.') }
    finally { setBusyExport(false) }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); void play() }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveProject() }
      if (event.key === 'Delete' && selected) removeClip()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
  useEffect(() => () => { playback.current.active = false; if (audioContext.current) void audioContext.current.close() }, [])

  const dropAsset = (event: DragEvent<HTMLDivElement>, trackId: string) => {
    event.preventDefault(); const assetId = event.dataTransfer.getData('asset'), asset = assets.find(item => item.id === assetId)
    if (!asset) return
    const rect = event.currentTarget.getBoundingClientRect(), start = Math.max(0, (event.clientX - rect.left + event.currentTarget.parentElement!.parentElement!.scrollLeft) / pps)
    commit(tracksRef.current.map(track => track.id === trackId ? { ...track, clips: [...track.clips, { id: newId(), assetId, start, duration: asset.buffer.duration, offset: 0, fadeIn: 0, fadeOut: 0 }] } : track))
  }

  const assignAsset = (trackId: string, assetId: string) => {
    const asset = assets.find(item => item.id === assetId)
    if (!asset) return
    commit(tracksRef.current.map(track => {
      if (track.id !== trackId) return track
      const start = Math.max(0, ...track.clips.map(clip => clip.start + clip.duration))
      return { ...track, clips: [...track.clips, { id: newId(), assetId, start, duration: asset.buffer.duration, offset: 0, fadeIn: 0, fadeOut: 0 }] }
    }))
    setSelected(null)
  }

  const activeTrack = selectedClip?.track ?? tracks[0]
  return <main className="app-shell">
    <TransportBar
      projectName={projectName}
      setProjectName={setProjectName}
      setSaved={setSaved}
      position={position}
      total={total}
      playing={playing}
      saved={saved}
      busyExport={busyExport}
      onSeek={seek}
      onPlay={() => void play()}
      onOpenProjects={() => void showProjects()}
      onSave={() => void saveProject()}
      onExport={() => void exportMix()}
    />
    <section className="workspace">
      <nav className="tool-rail" aria-label="Workspace tools">
        <button className="rail-tool active"><AudioLines size={18} /><span>TRACKS</span></button>
        <button className="rail-tool" onClick={() => setInspectorTab('Effects')}><SlidersHorizontal size={17} /><span>EFFECTS</span></button>
        <button className={`rail-tool ${mediaOpen ? 'active' : ''}`} onClick={() => setMediaOpen(value => !value)}><FileAudio size={17} /><span>MEDIA</span></button>
        <div className="rail-bottom"><i className="status-led" /><small>{saved ? 'SAVED' : 'UNSAVED'}</small><small>LOCAL SESSION</small></div>
      </nav>
      {mediaOpen && <aside className="media-drawer"><div className="drawer-title"><span>MEDIA LIBRARY</span><button className="icon-button" onClick={() => setMediaOpen(false)}><X size={15} /></button></div><label className={`import-button ${importProgress ? 'is-busy' : ''}`}><Import size={15} /> {importProgress ? 'Importing audio…' : 'Import audio'}<input type="file" accept="audio/*" multiple hidden disabled={Boolean(importProgress)} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) void importFiles(files) }} /></label>{assets.map(asset => <div key={asset.id} className="library-item" draggable onDragStart={event => event.dataTransfer.setData('asset', asset.id)}><FileAudio size={15} /><span className="file-name">{asset.name}</span></div>)}</aside>}
      <TimelineEditor
        tracks={tracks}
        assets={assets}
        selected={selected}
        selectedClip={selectedClip}
        position={position}
        zoom={zoom}
        scrollX={scrollX}
        total={total}
        canUndo={undoAvailable}
        canRedo={redoAvailable}
        onScroll={setScrollX}
        onAddTrack={addTrack}
        onRenameTrack={(trackId, name) => { setTracks(current => current.map(track => track.id === trackId ? { ...track, name } : track)); setSaved(false) }}
        onDeleteTrack={trackId => commit(tracksRef.current.filter(track => track.id !== trackId))}
        onToggleTrack={(trackId, control) => commit(tracksRef.current.map(track => track.id === trackId ? { ...track, [control]: !track[control] } : track))}
        onChangeVolume={(trackId, volume) => { setTracks(current => current.map(track => track.id === trackId ? { ...track, volume } : track)); setSaved(false) }}
        onDropAsset={dropAsset}
        onAssignAsset={assignAsset}
        onSeek={seek}
        onSelectClip={setSelected}
        onDragClip={dragClip}
        onTrimClip={trimClip}
        onZoomChange={setZoom}
        onSetFade={setFade}
        onSplitClip={splitClip}
        onRemoveClip={removeClip}
        onUndo={undo}
        onRedo={redo}
      />
      <InspectorPanel
        tab={inspectorTab}
        setTab={setInspectorTab}
        selectedClip={selectedClip}
        activeTrack={activeTrack}
        assets={assets}
        setTracks={setTracks}
        setSaved={setSaved}
        onToggleTrack={(trackId, control) => commit(tracksRef.current.map(track => track.id === trackId ? { ...track, [control]: !track[control] } : track))}
        onSetFade={setFade}
        onSplitClip={splitClip}
        onRemoveClip={removeClip}
      />
    </section>
    {importProgress && <div className="upload-status" role="status" aria-live="polite"><div className="upload-spinner" aria-hidden="true" /><div className="upload-status-copy"><strong>{importProgress.phase === 'uploading' ? 'Uploading audio' : 'Preparing waveform'}</strong><span title={importProgress.fileName}>{importProgress.fileName}</span><small>File {importProgress.current} of {importProgress.total}</small></div></div>}
    {toast && <div className="toast">{toast}</div>}
    {projectList && <div className="modal-backdrop" onClick={() => setProjectList(null)}><div className="modal" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={() => setProjectList(null)}><X size={18} /></button><FolderOpen size={20} /><h2>Open a saved session</h2><p>Your projects are stored by the EmDash backend.</p>{projectList.length ? projectList.map(project => <div className="saved-project" key={project.id}><span>{project.name}<small>{new Date(project.updatedAt).toLocaleString()}</small></span><button onClick={() => void openProject(project.id)}>Open project</button></div>) : <div className="no-saved">No saved sessions yet.</div>}</div></div>}
    {busyExport && <div className="modal-backdrop"><div className="modal export-modal"><div className="spinner" /><h2>Rendering your mix</h2><p>This can take a moment for longer sessions.</p></div></div>}
  </main>
}
