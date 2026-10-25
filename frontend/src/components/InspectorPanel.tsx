import { Activity, AudioLines, Scissors, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { Clip, Track } from '../api'
import { formatTime, type AudioAsset } from '../editorModel'

export type InspectorTab = 'Inspector' | 'Effects' | 'Automation'

type InspectorPanelProps = {
  tab: InspectorTab
  setTab: (tab: InspectorTab) => void
  selectedClip?: { track: Track; clip: Clip }
  activeTrack?: Track
  assets: AudioAsset[]
  setTracks: Dispatch<SetStateAction<Track[]>>
  setSaved: Dispatch<SetStateAction<boolean>>
  onToggleTrack: (trackId: string, control: 'mute' | 'solo') => void
  onSetFade: (kind: 'fadeIn' | 'fadeOut') => void
  onSplitClip: () => void
  onRemoveClip: () => void
}

export function InspectorPanel({ tab, setTab, selectedClip, activeTrack, assets, setTracks, setSaved, onToggleTrack, onSetFade, onSplitClip, onRemoveClip }: InspectorPanelProps) {
  const clipName = assets.find(asset => asset.id === selectedClip?.clip.assetId)?.name
  const updateTrack = (update: (track: Track) => Track) => {
    if (!activeTrack) return
    setTracks(current => current.map(track => track.id === activeTrack.id ? update(track) : track))
    setSaved(false)
  }

  return <aside className="inspector"><div className="inspector-tabs">{(['Inspector', 'Effects', 'Automation'] as const).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item.toUpperCase()}</button>)}</div>
    {tab === 'Inspector' && <div className="inspector-content">{selectedClip ? <><div className="inspector-clipname">{clipName}</div><div className="clip-actions"><button onClick={onSplitClip} title="Split selected clip at playhead"><Scissors size={15} /> Split at playhead</button><button onClick={onRemoveClip} title="Delete selected clip"><Trash2 size={15} /> Delete clip</button></div><p className="trim-help">Drag either orange edge of the clip to trim it.</p><div className="property-list"><div><span>LENGTH</span><b>{formatTime(selectedClip.clip.duration)}</b></div><div><span>START</span><b>{formatTime(selectedClip.clip.start)}</b></div><div><span>END</span><b>{formatTime(selectedClip.clip.start + selectedClip.clip.duration)}</b></div></div></> : <div className="inspector-empty"><AudioLines size={22} /><span>Select a clip to inspect it</span></div>}
      <section className="inspector-section"><div className="section-title">GAIN <span>{activeTrack ? `${(20 * Math.log10(Math.max(0.001, activeTrack.volume))).toFixed(1)} dB` : '0.0 dB'}</span></div><input className="inspector-range" aria-label="Gain" type="range" min="0" max="1.5" step="0.01" value={activeTrack?.volume ?? 0.8} onChange={event => updateTrack(track => ({ ...track, volume: Number(event.target.value) }))} /></section>
      <section className="inspector-section"><div className="section-title">PAN <span>{(activeTrack?.pan ?? 0).toFixed(1)}</span></div><input className="pan-range" aria-label="Pan" type="range" min="-1" max="1" step="0.01" value={activeTrack?.pan ?? 0} onChange={event => updateTrack(track => ({ ...track, pan: Number(event.target.value) }))} /></section>
      {activeTrack && <div className="inspector-toggles"><button className={activeTrack.mute ? 'on' : ''} onClick={() => onToggleTrack(activeTrack.id, 'mute')}>M <span>MUTE</span></button><button className={activeTrack.solo ? 'on' : ''} onClick={() => onToggleTrack(activeTrack.id, 'solo')}>S <span>SOLO</span></button></div>}
      <section className="inspector-section effects-summary"><div className="section-title">CLIP FADES</div><button disabled={!selectedClip} onClick={() => onSetFade('fadeIn')}>↗ <span>Fade in</span><b>{selectedClip?.clip.fadeIn.toFixed(2) ?? '—'} s</b></button><button disabled={!selectedClip} onClick={() => onSetFade('fadeOut')}>↘ <span>Fade out</span><b>{selectedClip?.clip.fadeOut.toFixed(2) ?? '—'} s</b></button></section><div className="inspector-footnote">Non-destructive clip controls</div></div>}
    {tab === 'Effects' && <div className="inspector-placeholder"><SlidersHorizontal size={21} /><b>Effects rack</b><span>Clip fades are available in Inspector. Realtime effects are not enabled yet.</span><button onClick={() => setTab('Inspector')}>Back to inspector</button></div>}
    {tab === 'Automation' && <div className="inspector-placeholder"><Activity size={21} /><b>Automation lanes</b><span>Volume and pan automation are not enabled yet.</span><button onClick={() => setTab('Inspector')}>Back to inspector</button></div>}
  </aside>
}
