import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { AudioLines, CircleHelp, Download, FileAudio, FolderOpen, Import, MoreHorizontal, Pause, Play, Plus, Redo2, Scissors, SkipBack, SkipForward, Trash2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { api, API_BASE, type AssetMeta, type Clip, type SavedProject, type Track } from './api'
import { encodeWav } from './audio'

type AudioAsset = AssetMeta & { buffer: AudioBuffer }
const COLORS = ['#a8df5d', '#58c7b8', '#b991f2', '#f2a36b', '#71b5f3', '#e980a7']
const newId = () => crypto.randomUUID()
const blankTrack = (name: string, index: number): Track => ({ id: newId(), name, color: COLORS[index % COLORS.length], volume: 0.8, mute: false, solo: false, clips: [] })
const initialTracks = () => [blankTrack('Lead vocals', 0), blankTrack('Rhythm', 1), blankTrack('Atmosphere', 2)]
const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds || 0)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}.${String(Math.floor((safe % 1) * 100)).padStart(2, '0')}`
}
const clone = (tracks: Track[]) => tracks.map(track => ({ ...track, clips: track.clips.map(clip => ({ ...clip })) }))

function Waveform({ asset, clip, color }: { asset: AudioAsset; clip: Clip; color: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const rect = element.getBoundingClientRect(), ratio = window.devicePixelRatio || 1
    if (!rect.width || !rect.height) return
    element.width = rect.width * ratio; element.height = rect.height * ratio
    const context = element.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    const samples = asset.buffer.getChannelData(0), start = Math.floor(clip.offset * asset.buffer.sampleRate)
    const length = Math.max(1, Math.floor(clip.duration * asset.buffer.sampleRate)), step = Math.max(1, Math.floor(length / rect.width))
    const middle = rect.height * 0.59, amplitude = rect.height * 0.36
    context.strokeStyle = color; context.lineWidth = 1; context.globalAlpha = 0.9; context.beginPath()
    for (let x = 0; x < rect.width; x++) {
      let low = 1, high = -1
      for (let i = 0; i < step; i++) {
        const value = samples[Math.min(samples.length - 1, start + Math.floor(x * length / rect.width) + i)] || 0
        low = Math.min(low, value); high = Math.max(high, value)
      }
      context.moveTo(x + 0.5, middle - high * amplitude); context.lineTo(x + 0.5, middle - low * amplitude)
    }
    context.stroke()
  }, [asset, clip.duration, clip.offset, color])
  return <canvas ref={canvas} className="waveform" aria-hidden="true" />
}

export default function App() {
  const [projectId, setProjectId] = useState<string>(newId())
  const [projectName, setProjectName] = useState('Untitled session')
  const [tracks, setTracks] = useState<Track[]>(initialTracks)
  const [assets, setAssets] = useState<AudioAsset[]>([])
  const [position, setPosition] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [selected, setSelected] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(false)
  const [scrollX, setScrollX] = useState(0)
  const [saved, setSaved] = useState(true)
  const [toast, setToast] = useState('')
  const [projectList, setProjectList] = useState<Array<Pick<SavedProject, 'id' | 'name' | 'updatedAt'>> | null>(null)
  const [busyExport, setBusyExport] = useState(false)
  const audioContext = useRef<AudioContext | null>(null)
  const playback = useRef({ active: false, offset: 0, startAt: 0, raf: 0 })
  const tracksRef = useRef(tracks)
  const positionRef = useRef(position)
  const history = useRef<{ past: Track[][]; future: Track[][] }>({ past: [], future: [] })
  const pps = zoom
  const total = useMemo(() => Math.max(0, ...tracks.flatMap(track => track.clips.map(clip => clip.start + clip.duration))), [tracks])
  const selectedClip = tracks.flatMap(track => track.clips.map(clip => ({ track, clip }))).find(item => item.clip.id === selected)
  const showToast = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2300) }, [])

  useEffect(() => { tracksRef.current = tracks }, [tracks])
  useEffect(() => { positionRef.current = position }, [position])
  useEffect(() => { setSaved(true) }, [])
  const commit = useCallback((next: Track[]) => {
    history.current.past.push(clone(tracksRef.current)); if (history.current.past.length > 40) history.current.past.shift()
    history.current.future = []; setTracks(next); setSaved(false)
  }, [])
  const getAudioContext = useCallback(async () => {
    if (!audioContext.current) audioContext.current = new AudioContext()
    if (audioContext.current.state === 'suspended') await audioContext.current.resume()
    return audioContext.current
  }, [])
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
    const element = event.currentTarget, before = clone(tracksRef.current), origin = event.clientX, initial = clip.start
    element.setPointerCapture(event.pointerId)
    const move = (moveEvent: PointerEvent) => patchClip(clip.id, item => ({ ...item, start: Math.max(0, initial + (moveEvent.clientX - origin) / pps) }))
    const end = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', end); finishPointerEdit(before) }
    element.addEventListener('pointermove', move); element.addEventListener('pointerup', end)
  }
  const trimClip = (event: ReactPointerEvent<HTMLElement>, clip: Clip, side: 'left' | 'right') => {
    event.stopPropagation()
    const element = event.currentTarget, before = clone(tracksRef.current), origin = event.clientX
    element.setPointerCapture(event.pointerId)
    if (side === 'left') {
      const oldStart = clip.start, oldOffset = clip.offset, oldDuration = clip.duration
      const move = (moveEvent: PointerEvent) => {
        const delta = (moveEvent.clientX - origin) / pps
        const newStart = Math.max(oldStart - oldOffset, Math.min(oldStart + delta, oldStart + oldDuration - 0.08))
        patchClip(clip.id, item => ({ ...item, start: newStart, offset: Math.max(0, oldOffset + newStart - oldStart), duration: oldDuration - (newStart - oldStart) }))
      }
      const end = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', end); finishPointerEdit(before) }
      element.addEventListener('pointermove', move); element.addEventListener('pointerup', end)
    } else {
      const oldDuration = clip.duration, assetDuration = assets.find(asset => asset.id === clip.assetId)?.buffer.duration ?? oldDuration + clip.offset
      const move = (moveEvent: PointerEvent) => patchClip(clip.id, item => ({ ...item, duration: Math.max(0.08, Math.min(assetDuration - item.offset, oldDuration + (moveEvent.clientX - origin) / pps)) }))
      const end = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', end); finishPointerEdit(before) }
      element.addEventListener('pointermove', move); element.addEventListener('pointerup', end)
    }
  }

  const loadAsset = useCallback(async (meta: AssetMeta, context?: AudioContext): Promise<AudioAsset> => {
    const response = await fetch(meta.url.startsWith('http') ? meta.url : `${API_BASE}${meta.url}`)
    if (!response.ok) throw new Error(`Could not load ${meta.name}`)
    const buffer = await (context ?? await getAudioContext()).decodeAudioData(await response.arrayBuffer())
    return { ...meta, duration: meta.duration ?? buffer.duration, buffer }
  }, [getAudioContext])

  const importFiles = async (files: FileList | File[]) => {
    const context = await getAudioContext()
    const additions: AudioAsset[] = []
    for (const file of Array.from(files)) {
      try {
        const meta = await api.uploadAsset(file)
        additions.push(await loadAsset(meta, context))
      } catch (error) { showToast(error instanceof Error ? error.message : `Could not import ${file.name}`) }
    }
    if (!additions.length) return
    setAssets(current => [...current, ...additions])
    const next = clone(tracksRef.current)
    if (!next.length) next.push(blankTrack('Track 1', 0))
    additions.forEach(asset => next[next.length - 1].clips.push({ id: newId(), assetId: asset.id, start: 0, duration: asset.buffer.duration, offset: 0, fadeIn: 0, fadeOut: 0 }))
    commit(next); showToast(additions.length === 1 ? 'Audio added to timeline' : `${additions.length} audio files added`)
  }

  const addTrack = () => { commit([...clone(tracksRef.current), blankTrack(`Track ${tracksRef.current.length + 1}`, tracksRef.current.length)]) }
  const saveProject = async () => {
    try {
      await api.saveProject(projectId, { name: projectName, tracks, assets: assets.map(({ buffer: _buffer, ...meta }) => meta) })
      setSaved(true); showToast('Project saved to the backend')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not save project') }
  }
  const openProject = async (id: string) => {
    try {
      const data = await api.getProject(id), context = await getAudioContext()
      const loaded = await Promise.all(data.assets.map(asset => loadAsset(asset, context)))
      setProjectId(id); setProjectName(data.name); setTracks(data.tracks); setAssets(loaded); setPosition(0); setSelected(null)
      history.current = { past: [], future: [] }; setProjectList(null); setSaved(true)
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not open project') }
  }
  const showProjects = async () => {
    try { setProjectList(await api.listProjects()) }
    catch (error) { showToast(error instanceof Error ? error.message : 'Could not reach the backend') }
  }
  const stopPlayback = useCallback(() => {
    playback.current.active = false; cancelAnimationFrame(playback.current.raf); setPlaying(false)
    audioContext.current?.suspend().catch(() => undefined)
  }, [])
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
        const source = context.createBufferSource(), gain = context.createGain()
        source.buffer = asset.buffer; gain.gain.value = track.volume
        const when = now + Math.max(0, clip.start - from), fadeIn = Math.max(0, clip.fadeIn - delta)
        gain.gain.setValueAtTime(track.volume, when)
        if (fadeIn > 0) { gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(track.volume, when + Math.min(fadeIn, duration)) }
        if (clip.fadeOut > 0) {
          if (duration > clip.fadeOut) gain.gain.setValueAtTime(track.volume, when + duration - clip.fadeOut)
          gain.gain.linearRampToValueAtTime(0, when + duration)
        }
        source.connect(gain).connect(context.destination); source.start(when, clip.offset + delta, duration)
      })
    })
  }, [assets])
  const play = async () => {
    if (playing) { const current = playback.current.offset + (audioContext.current!.currentTime - playback.current.startAt); setPosition(current); stopPlayback(); return }
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
    if (playing) { stopPlayback(); window.setTimeout(() => { positionRef.current = next; void play() }, 0) }
  }
  const undo = () => {
    const previous = history.current.past.pop(); if (!previous) return
    history.current.future.push(clone(tracksRef.current)); setTracks(clone(previous))
  }
  const redo = () => {
    const next = history.current.future.pop(); if (!next) return
    history.current.past.push(clone(tracksRef.current)); setTracks(clone(next))
  }
  const removeClip = () => {
    if (!selected) return
    commit(tracksRef.current.map(track => ({ ...track, clips: track.clips.filter(clip => clip.id !== selected) }))); setSelected(null)
  }
  const splitClip = () => {
    if (!selectedClip) return
    const { clip, track } = selectedClip, relative = position - clip.start
    if (relative <= 0.03 || relative >= clip.duration - 0.03) { showToast('Place the playhead inside the selected clip'); return }
    const next = clone(tracksRef.current), target = next.find(item => item.id === track.id)!, index = target.clips.findIndex(item => item.id === clip.id)
    const right = { ...target.clips[index], id: newId(), start: position, duration: clip.duration - relative, offset: clip.offset + relative, fadeIn: 0 }
    target.clips[index].duration = relative; target.clips[index].fadeOut = 0; target.clips.push(right); commit(next); setSelected(right.id)
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
          const source = offline.createBufferSource(), gain = offline.createGain(); source.buffer = asset.buffer
          gain.gain.value = track.volume
          if (clip.fadeIn) { gain.gain.setValueAtTime(0, clip.start); gain.gain.linearRampToValueAtTime(track.volume, clip.start + clip.fadeIn) }
          if (clip.fadeOut) { gain.gain.setValueAtTime(track.volume, Math.max(clip.start, clip.start + clip.duration - clip.fadeOut)); gain.gain.linearRampToValueAtTime(0, clip.start + clip.duration) }
          source.connect(gain).connect(offline.destination); source.start(clip.start, clip.offset, clip.duration)
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

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">e</span><span>emdash<span className="brand-dot">.</span></span></a>
      <div className="project-title"><span className="eyebrow">PROJECT</span><strong title="Double click to rename" onDoubleClick={event => { const node = event.currentTarget; node.contentEditable = 'true'; node.focus() }} onBlur={event => { const next = event.currentTarget.textContent?.trim(); if (next) { setProjectName(next); setSaved(false) } event.currentTarget.contentEditable = 'false' }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }}>{projectName}</strong><span className="saved-status"><i className={saved ? '' : 'unsaved'} />{saved ? 'Saved to backend' : 'Unsaved changes'}</span></div>
      <div className="top-actions"><button className="button button-quiet" onClick={() => void showProjects()}><FolderOpen size={14} /> Open project</button><button className="button button-quiet" onClick={() => void saveProject()}>Save</button><button className="button button-primary" onClick={() => void exportMix()} disabled={busyExport}><Download size={14} /> {busyExport ? 'Rendering…' : 'Export mix'}</button></div>
    </header>
    <section className="workspace">
      <aside className="sidebar">
        <div className="sidebar-heading"><span>YOUR SESSION</span><button className="icon-button" title="New project" onClick={() => { stopPlayback(); setProjectId(newId()); setProjectName('Untitled session'); setTracks(initialTracks()); setAssets([]); setPosition(0); setSelected(null); history.current = { past: [], future: [] }; setSaved(false) }}><Plus size={16} /></button></div>
        <div className="session-card"><div className="session-art"><AudioLines size={22} /></div><div className="session-copy"><strong>{projectName}</strong><small>{saved ? 'Saved in your workspace' : 'Changes not saved'}</small></div><MoreHorizontal size={17} className="text-muted" /></div>
        <div className="sidebar-divider" />
        <div className="sidebar-heading"><span>LIBRARY</span><span className="count-pill">{assets.length}</span></div>
        <div className="library-list">{assets.length === 0 ? <div className="empty-library"><AudioLines size={22} /><span>Your audio files<br />will show up here</span></div> : assets.map(asset => <div key={asset.id} className="library-item" draggable onDragStart={event => event.dataTransfer.setData('asset', asset.id)}><FileAudio size={15} className="file-glyph" /><span className="file-name" title={asset.name}>{asset.name}</span><small>{formatTime(asset.buffer.duration).slice(0, 5)}</small></div>)}</div>
        <label className="import-button"><Import size={15} /> Import audio<input type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac" multiple hidden onChange={event => { if (event.target.files?.length) void importFiles(event.target.files); event.target.value = '' }} /></label>
        <div className="sidebar-bottom"><div className="keyboard-hint"><kbd>Space</kbd><span>to play / pause</span></div><div className="user-profile"><div className="avatar">A</div><div><strong>Abhinav</strong><small>Personal workspace</small></div><span className="profile-menu">⌄</span></div></div>
      </aside>
      <section className="editor">
        <div className="editor-header"><div><div className="breadcrumb">Projects <span>/</span> <b>{projectName}</b></div><h1>Make something <em>sound</em> like you.</h1><p>Layer, shape, and find the feeling in your sound.</p></div><button className="button button-outline" onClick={addTrack}><Plus size={14} /> Add track</button></div>
        <div className="transport"><div className="transport-controls"><button className="transport-small" title="Go to start" onClick={() => seek(0)}><SkipBack size={15} /></button><button className="play-button" title={playing ? 'Pause' : 'Play'} onClick={() => void play()}>{playing ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button><button className="transport-small" title="Go to end" onClick={() => seek(total)}><SkipForward size={15} /></button><span className="transport-divider" /><button className={`loop-button ${loop ? 'active' : ''}`} title="Loop playback" onClick={() => setLoop(value => !value)}>↻</button></div><div className="time-readout"><strong>{formatTime(position)}</strong><span>/</span><span>{formatTime(total)}</span></div><div className="transport-right"><span className="tempo-indicator"><i /> AUDIO ENGINE READY</span><button className="icon-button" title="Zoom out" onClick={() => setZoom(value => Math.max(40, value - 20))}><ZoomOut size={14} /></button><span className="zoom-label">{zoom}%</span><button className="icon-button" title="Zoom in" onClick={() => setZoom(value => Math.min(240, value + 20))}><ZoomIn size={14} /></button></div></div>
        <div className="timeline-wrap"><div className="timeline-head"><div className="track-head-spacer"><span>TRACKS <b>{tracks.length}</b></span><AudioLines size={15} /></div><div className="ruler-scroll"><div className="ruler-inner" style={{ transform: `translateX(-${scrollX}px)` }}>{Array.from({ length: Math.max(8, Math.ceil(total) + 1) }, (_, second) => <span key={second} style={{ left: second * pps }}><i />{`${String(Math.floor(second / 60)).padStart(2, '0')}:${String(second % 60).padStart(2, '0')}`}</span>)}</div></div></div>
          <div className="track-list" onScroll={event => setScrollX(event.currentTarget.scrollLeft)}>{tracks.map((track, trackIndex) => <div className="track-row" key={track.id}><div className="track-meta"><div className="track-name-line"><i className="track-color" style={{ background: track.color }} /><input className="track-name" aria-label="Track name" value={track.name} onChange={event => { const name = event.target.value; setTracks(current => current.map(item => item.id === track.id ? { ...item, name } : item)); setSaved(false) }} onBlur={() => setTracks(current => current.map(item => item.id === track.id ? { ...item, name: item.name.trim() || `Track ${trackIndex + 1}` } : item))} /><button className="track-menu" title="Delete track" onClick={() => { commit(tracksRef.current.filter(item => item.id !== track.id)); if (track.clips.some(clip => clip.id === selected)) setSelected(null) }}><MoreHorizontal size={15} /></button></div><div className="track-controls"><button className={`track-toggle ${track.mute ? 'on' : ''}`} onClick={() => commit(tracksRef.current.map(item => item.id === track.id ? { ...item, mute: !item.mute } : item))}>M</button><button className={`track-toggle ${track.solo ? 'on' : ''}`} onClick={() => commit(tracksRef.current.map(item => item.id === track.id ? { ...item, solo: !item.solo } : item))}>S</button><input className="track-vol" aria-label={`${track.name} volume`} type="range" min="0" max="1.5" step="0.01" value={track.volume} onChange={event => { const volume = Number(event.target.value); setTracks(current => current.map(item => item.id === track.id ? { ...item, volume } : item)); setSaved(false) }} /><span className="track-vol-label">{Math.round(track.volume * 100)}%</span></div></div><div className="track-timeline" style={{ backgroundSize: `${pps}px 100%`, width: Math.max(700, total * pps + 200) }} onDragOver={event => event.preventDefault()} onDrop={event => dropAsset(event, track.id)} onClick={event => { if (event.target === event.currentTarget) seek(Math.max(0, (event.clientX - event.currentTarget.getBoundingClientRect().left + event.currentTarget.parentElement!.parentElement!.scrollLeft) / pps)) }}>
            {track.clips.map(clip => {
              const asset = assets.find(item => item.id === clip.assetId)
              if (!asset) return null
              return <div
                key={clip.id}
                className={`clip ${selected === clip.id ? 'selected' : ''}`}
                style={{ left: clip.start * pps, width: Math.max(16, clip.duration * pps), ['--clip-color' as string]: track.color }}
                onClick={event => { event.stopPropagation(); setSelected(clip.id) }}
                onPointerDown={event => dragClip(event, clip)}
              >
                <span className="clip-label">{asset.name}</span>
                <Waveform asset={asset} clip={clip} color={track.color} />
                <i data-edge="left" className="clip-edge left" onPointerDown={event => trimClip(event, clip, 'left')} />
                <i data-edge="right" className="clip-edge right" onPointerDown={event => trimClip(event, clip, 'right')} />
              </div>
            })}
            <div className="playhead" style={{ left: position * pps }} />
          </div></div>)}</div><div className="timeline-foot"><span><i className="legend-dot" /> PLAYHEAD</span><span>Drag clips to arrange · drag an edge to trim · click to select</span></div></div>
        <div className="bottom-bar"><div className="selection-info"><span className="selection-dot" style={{ background: selectedClip?.track.color }} />{selectedClip ? `${assets.find(asset => asset.id === selectedClip.clip.assetId)?.name} · ${formatTime(selectedClip.clip.duration)}` : 'No clip selected'}</div><div className="editing-actions"><button disabled={!selectedClip} onClick={() => setFade('fadeIn')}>↗ <span>Fade in</span></button><button disabled={!selectedClip} onClick={() => setFade('fadeOut')}>↘ <span>Fade out</span></button><button disabled={!selectedClip} onClick={splitClip}><Scissors size={13} /> <span>Split at playhead</span></button><button disabled={!selectedClip} onClick={removeClip}><Trash2 size={13} /> <span>Remove clip</span></button><button disabled={!history.current.past.length} title="Undo" onClick={undo}><Undo2 size={16} /></button><button disabled={!history.current.future.length} title="Redo" onClick={redo}><Redo2 size={16} /></button></div><button className="help-button"><CircleHelp size={14} /> <span>Shortcuts</span></button></div>
      </section>
    </section>
    {toast && <div className="toast">{toast}</div>}
    {projectList && <div className="modal-backdrop" onClick={() => setProjectList(null)}><div className="modal" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={() => setProjectList(null)}><X size={18} /></button><div className="modal-icon"><FolderOpen size={20} /></div><h2>Open a saved session</h2><p>Your projects are stored by the EmDash backend.</p>{projectList.length ? projectList.map(project => <div className="saved-project" key={project.id}><span>{project.name}<small>{new Date(project.updatedAt).toLocaleString()}</small></span><button onClick={() => void openProject(project.id)}>Open project</button></div>) : <div className="no-saved">No saved sessions yet.</div>}</div></div>}
    {busyExport && <div className="modal-backdrop"><div className="modal export-modal"><div className="spinner" /><h2>Rendering your mix</h2><p>This can take a moment for longer sessions.</p></div></div>}
  </main>
}
