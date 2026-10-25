export const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type SavedProject = {
  id: string
  name: string
  updatedAt: string
  tracks: Track[]
  assets: AssetMeta[]
}
export type AssetMeta = { id: string; name: string; url: string; contentType: string; size?: number; duration?: number }
export type Clip = { id: string; assetId: string; start: number; duration: number; offset: number; fadeIn: number; fadeOut: number }
export type Track = { id: string; name: string; color: string; volume: number; pan?: number; mute: boolean; solo: boolean; clips: Clip[] }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api${path}`, init)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? `API request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export const api = {
  listProjects: () => request<Array<Pick<SavedProject, 'id' | 'name' | 'updatedAt'>>>('/projects'),
  getProject: (id: string) => request<SavedProject>(`/projects/${id}`),
  saveProject: (id: string, project: Pick<SavedProject, 'name' | 'tracks' | 'assets'>) => request(`/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project) }),
  uploadAsset: async (file: File) => {
    const body = new FormData(); body.append('file', file)
    return request<AssetMeta>('/assets', { method: 'POST', body })
  },
}
