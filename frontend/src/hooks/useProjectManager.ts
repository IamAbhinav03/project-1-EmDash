import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { API_BASE, api, type AssetMeta, type SavedProject, type Track } from '../api'
import { blankTrack, cloneTracks, newId, type AudioAsset } from '../editorModel'

type ProjectSummary = Pick<SavedProject, 'id' | 'name' | 'updatedAt'>

type ProjectManagerOptions = {
  projectId: string
  projectName: string
  tracksRef: { current: Track[] }
  assets: AudioAsset[]
  getAudioContext: () => Promise<AudioContext>
  commit: (tracks: Track[]) => void
  showToast: (message: string) => void
  setAssets: Dispatch<SetStateAction<AudioAsset[]>>
  setProjectId: Dispatch<SetStateAction<string>>
  setProjectName: Dispatch<SetStateAction<string>>
  setTracks: Dispatch<SetStateAction<Track[]>>
  setPosition: Dispatch<SetStateAction<number>>
  setSelected: Dispatch<SetStateAction<string | null>>
  setProjectList: Dispatch<SetStateAction<ProjectSummary[] | null>>
  setSaved: Dispatch<SetStateAction<boolean>>
  resetHistory: () => void
}

export function useProjectManager(options: ProjectManagerOptions) {
  const {
    projectId, projectName, tracksRef, assets, getAudioContext, commit, showToast,
    setAssets, setProjectId, setProjectName, setTracks, setPosition, setSelected,
    setProjectList, setSaved, resetHistory,
  } = options

  const loadAsset = useCallback(async (meta: AssetMeta, context?: AudioContext): Promise<AudioAsset> => {
    const response = await fetch(meta.url.startsWith('http') ? meta.url : `${API_BASE}${meta.url}`)
    if (!response.ok) throw new Error(`Could not load ${meta.name}`)
    const buffer = await (context ?? await getAudioContext()).decodeAudioData(await response.arrayBuffer())
    return { ...meta, duration: meta.duration ?? buffer.duration, buffer }
  }, [getAudioContext])

  const importFiles = useCallback(async (files: FileList | File[]) => {
    // FileList is live and the input is reset after this handler runs. Copy it
    // before awaiting audio setup so clearing the input cannot empty the batch.
    const selectedFiles = Array.from(files)
    if (!selectedFiles.length) return
    let context: AudioContext
    try {
      context = await getAudioContext()
    } catch (error) {
      showToast(error instanceof Error ? `Could not initialize audio: ${error.message}` : 'Could not initialize audio')
      return
    }
    const additions: AudioAsset[] = []
    for (const file of selectedFiles) {
      try {
        const meta = await api.uploadAsset(file)
        additions.push(await loadAsset(meta, context))
      } catch (error) {
        showToast(error instanceof Error ? error.message : `Could not import ${file.name}`)
      }
    }
    if (!additions.length) return

    setAssets(current => [...current, ...additions])
    const next = cloneTracks(tracksRef.current)
    if (!next.length) next.push(blankTrack('Track 1', 0))
    additions.forEach(asset => next[next.length - 1].clips.push({
      id: newId(), assetId: asset.id, start: 0, duration: asset.buffer.duration, offset: 0, fadeIn: 0, fadeOut: 0,
    }))
    commit(next)
    showToast(additions.length === 1 ? 'Audio added to timeline' : `${additions.length} audio files added`)
  }, [commit, getAudioContext, loadAsset, setAssets, showToast, tracksRef])

  const saveProject = useCallback(async () => {
    try {
      await api.saveProject(projectId, { name: projectName, tracks: tracksRef.current, assets: assets.map(({ buffer: _buffer, ...meta }) => meta) })
      setSaved(true)
      showToast('Project saved to the backend')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save project')
    }
  }, [assets, projectId, projectName, setSaved, showToast, tracksRef])

  const openProject = useCallback(async (id: string) => {
    try {
      const data = await api.getProject(id)
      const context = await getAudioContext()
      const loaded = await Promise.all(data.assets.map(asset => loadAsset(asset, context)))
      setProjectId(id)
      setProjectName(data.name)
      setTracks(data.tracks)
      setAssets(loaded)
      setPosition(0)
      setSelected(null)
      resetHistory()
      setProjectList(null)
      setSaved(true)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not open project')
    }
  }, [getAudioContext, loadAsset, resetHistory, setAssets, setPosition, setProjectId, setProjectList, setProjectName, setSaved, setSelected, setTracks, showToast])

  const showProjects = useCallback(async () => {
    try {
      setProjectList(await api.listProjects())
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not reach the backend')
    }
  }, [setProjectList, showToast])

  return { importFiles, saveProject, openProject, showProjects }
}
