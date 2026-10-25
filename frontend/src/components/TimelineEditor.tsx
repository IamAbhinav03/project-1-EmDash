import { useMemo } from 'react'
import { AudioLines, MoreHorizontal, Plus, Redo2, Scissors, Trash2, Undo2 } from 'lucide-react'
import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { Clip, Track } from '../api'
import { formatTime, type AudioAsset } from '../editorModel'
import { Waveform } from './Waveform'

type SelectedClip = { track: Track; clip: Clip }

type TimelineEditorProps = {
  tracks: Track[]
  assets: AudioAsset[]
  selected: string | null
  selectedClip?: SelectedClip
  position: number
  zoom: number
  scrollX: number
  total: number
  canUndo: boolean
  canRedo: boolean
  onScroll: (scrollLeft: number) => void
  onAddTrack: () => void
  onRenameTrack: (trackId: string, name: string) => void
  onDeleteTrack: (trackId: string) => void
  onToggleTrack: (trackId: string, control: 'mute' | 'solo') => void
  onChangeVolume: (trackId: string, volume: number) => void
  onDropAsset: (event: DragEvent<HTMLDivElement>, trackId: string) => void
  onSeek: (seconds: number) => void
  onSelectClip: (clipId: string) => void
  onDragClip: (event: ReactPointerEvent<HTMLDivElement>, clip: Clip) => void
  onTrimClip: (event: ReactPointerEvent<HTMLElement>, clip: Clip, side: 'left' | 'right') => void
  onZoomChange: (zoom: number) => void
  onSetFade: (kind: 'fadeIn' | 'fadeOut') => void
  onSplitClip: () => void
  onRemoveClip: () => void
  onUndo: () => void
  onRedo: () => void
}

export function TimelineEditor(props: TimelineEditorProps) {
  const { tracks, assets, selected, selectedClip, position, zoom, scrollX, total, canUndo, canRedo } = props
  const overviewWidth = Math.max(800, total * zoom + 200)
  const rulerMarks = useMemo(() => Array.from({ length: Math.max(8, Math.ceil(total / 30) + 3) }, (_, i) => i * 30), [total])

  return <section className="editor">
    <div className="timeline-wrap">
      <div className="timeline-head"><div className="track-head-spacer"><span>TRACKS <b>{String(tracks.length).padStart(2, '0')}</b></span><button className="icon-button" title="Add track" onClick={props.onAddTrack}><Plus size={15} /></button></div><div className="ruler-scroll"><div className="ruler-inner" style={{ transform: `translateX(-${scrollX}px)` }}>{rulerMarks.map(second => <span key={second} style={{ left: second * zoom }}><i />{`${Math.floor(second / 60)}:${String(second % 60).padStart(2, '0')}`}</span>)}</div><span className="snap-indicator">◌ SNAP ·</span></div></div>
      <div className="track-list" onScroll={event => props.onScroll(event.currentTarget.scrollLeft)}>{tracks.map((track, i) => <div className="track-row" key={track.id}>
        <div className="track-meta"><div className="track-name-line"><i className="track-color" style={{ background: selectedClip?.track.id === track.id ? '#f04428' : track.color }} /><AudioLines size={19} className="track-wave-icon" /><span className="track-index">{String(i + 1).padStart(2, '0')}</span><input className="track-name" aria-label="Track name" value={track.name} onChange={event => props.onRenameTrack(track.id, event.target.value)} /><button className="track-menu" title="Delete track" onClick={() => props.onDeleteTrack(track.id)}><MoreHorizontal size={14} /></button></div>
          <div className="track-controls"><button className={`track-toggle ${track.mute ? 'on' : ''}`} onClick={() => props.onToggleTrack(track.id, 'mute')}>M</button><button className={`track-toggle ${track.solo ? 'on' : ''}`} onClick={() => props.onToggleTrack(track.id, 'solo')}>S</button><input className="track-vol" aria-label={`${track.name} volume`} type="range" min="0" max="1.5" step="0.01" value={track.volume} onChange={event => props.onChangeVolume(track.id, Number(event.target.value))} /><span className="track-vol-label">▥</span></div>
        </div>
        <div className="track-timeline" style={{ backgroundSize: `${zoom}px 100%`, width: Math.max(700, total * zoom + 200) }} onDragOver={event => event.preventDefault()} onDrop={event => props.onDropAsset(event, track.id)} onClick={event => { if (event.target === event.currentTarget) props.onSeek(Math.max(0, (event.clientX - event.currentTarget.getBoundingClientRect().left + event.currentTarget.parentElement!.parentElement!.scrollLeft) / zoom)) }}>
          {track.clips.map(clip => { const asset = assets.find(item => item.id === clip.assetId); if (!asset) return null; return <div key={clip.id} className={`clip ${selected === clip.id ? 'selected' : ''}`} style={{ left: clip.start * zoom, width: Math.max(16, clip.duration * zoom), ['--clip-color' as string]: track.color }} onClick={event => { event.stopPropagation(); props.onSelectClip(clip.id) }} onPointerDown={event => props.onDragClip(event, clip)}><span className="clip-label">{asset.name}</span><Waveform asset={asset} clip={clip} color="#b9babb" /><i data-edge="left" className="clip-edge left" onPointerDown={event => props.onTrimClip(event, clip, 'left')} /><i data-edge="right" className="clip-edge right" onPointerDown={event => props.onTrimClip(event, clip, 'right')} /></div> })}
          <div className="playhead" style={{ left: position * zoom }} />
        </div>
      </div>)}</div>
      <div className="overview" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); if (total) props.onSeek((event.clientX - rect.left) / rect.width * total) }}><div className="overview-content" style={{ width: overviewWidth }}>{tracks.map(track => <div className="overview-row" key={track.id}>{track.clips.map(clip => <i key={clip.id} style={{ left: clip.start * zoom, width: Math.max(2, clip.duration * zoom), background: selected === clip.id ? '#f04428' : '#777b7d' }} />)}</div>)}<span className="overview-window" style={{ left: scrollX, width: Math.max(80, document.querySelector('.track-list')?.clientWidth ?? 500) }} /></div><span className="overview-label">OVERVIEW</span></div>
    </div>
    <footer className="editor-footer"><div className="zoom-control"><span>ZOOM</span><input type="range" min="40" max="240" step="20" value={zoom} onChange={event => props.onZoomChange(Number(event.target.value))} /><span>{zoom}%</span></div><div className="selection-info">{selectedClip ? `${assets.find(asset => asset.id === selectedClip.clip.assetId)?.name} · ${formatTime(selectedClip.clip.duration)}` : 'NO CLIP SELECTED'}</div><div className="editing-actions"><button disabled={!selectedClip} onClick={() => props.onSetFade('fadeIn')}>↗ <span>FADE IN</span></button><button disabled={!selectedClip} onClick={() => props.onSetFade('fadeOut')}>↘ <span>FADE OUT</span></button><button disabled={!selectedClip} onClick={props.onSplitClip} title="Split"><Scissors size={13} /></button><button disabled={!selectedClip} onClick={props.onRemoveClip} title="Remove"><Trash2 size={13} /></button><button disabled={!canUndo} title="Undo" onClick={props.onUndo}><Undo2 size={15} /></button><button disabled={!canRedo} title="Redo" onClick={props.onRedo}><Redo2 size={15} /></button></div></footer>
  </section>
}
