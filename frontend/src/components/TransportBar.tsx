import { Activity, AudioLines, Download, FolderOpen, MoreHorizontal, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { formatTime } from '../editorModel'

type TransportBarProps = {
  projectName: string
  setProjectName: Dispatch<SetStateAction<string>>
  setSaved: Dispatch<SetStateAction<boolean>>
  position: number
  total: number
  playing: boolean
  saved: boolean
  busyExport: boolean
  onSeek: (seconds: number) => void
  onPlay: () => void
  onOpenProjects: () => void
  onSave: () => void
  onExport: () => void
}

export function TransportBar(props: TransportBarProps) {
  const { projectName, setProjectName, setSaved, position, total, playing, saved, busyExport } = props

  return <header className="topbar">
    <div className="brand-area"><button className="header-menu" aria-label="Tools"><MoreHorizontal size={18} /></button><a className="brand" href="#"><span className="brand-mark"><AudioLines size={16} /></span><span>EMDASH<span className="brand-dot"> / </span>STUDIO</span></a></div>
    <div className="project-title"><strong title="Double click to rename" onDoubleClick={event => { const node = event.currentTarget; node.contentEditable = 'true'; node.focus() }} onBlur={event => { const next = event.currentTarget.textContent?.trim(); if (next) { setProjectName(next); setSaved(false) } event.currentTarget.contentEditable = 'false' }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }}>{projectName}</strong><span>Project / Session 01</span></div>
    <div className="transport"><button className="transport-small" title="Go to start" onClick={() => props.onSeek(0)}><SkipBack size={15} /></button><button className="transport-play" title={playing ? 'Pause' : 'Play'} onClick={props.onPlay}>{playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</button><button className="transport-small" title="Go to end" onClick={() => props.onSeek(total)}><SkipForward size={15} /></button><span className="transport-rule" /><div className="time-readout"><strong>{formatTime(position)}</strong><span>/ {formatTime(total)}</span></div></div>
    <div className="top-metrics"><div className="metric"><b>120.0</b><small>BPM</small></div><div className="metric"><b>4/4</b><small>TIME SIG</small></div><Activity size={18} className="signal-icon" /><span className="header-divider" /><button className="icon-button" title="Open project" onClick={props.onOpenProjects}><FolderOpen size={16} /></button><button className="icon-button" title="Save project" onClick={props.onSave}><span className="save-indicator" data-saved={saved} /></button><button className="export-button" onClick={props.onExport} disabled={busyExport}><Download size={15} /> Export</button></div>
  </header>
}
