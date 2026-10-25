# Frontend structure and editor behavior

## Entry point and component responsibilities

- `src/main.tsx` imports global CSS and mounts `<App />` under React Strict Mode.
- `src/App.tsx` is the session controller. It owns project and track state, wires child callbacks, handles timeline edits, manages the Web Audio context, and coordinates playback/export.
- `components/TransportBar.tsx` shows project title, playback controls, playhead time, save/open actions, and export. Double-click the title to edit it.
- `components/TimelineEditor.tsx` renders the ruler, track headers, track controls, timeline clips, overview, zoom, and edit action buttons.
- `components/Waveform.tsx` draws the selected source segment into a canvas.
- `components/InspectorPanel.tsx` displays selected clip timing, track gain/pan/mute/solo and clip fade controls. Effects and Automation are explanatory placeholders.
- `hooks/useProjectManager.ts` encapsulates API-backed import, save, open, and project listing.
- `hooks/useTrackHistory.ts` owns undo/redo snapshots.
- `editorModel.ts` provides default tracks, IDs, clone helpers, and time formatting.
- `api.ts` is the typed HTTP client and shared serializable model.
- `audio.ts` encodes the rendered audio buffer as a WAV Blob.

## Main state

`App` keeps state for project id/name; tracks/assets; playhead, zoom, and horizontal scroll; selected clip; playback; active inspector tab and media drawer; saved/unsaved status; project picker; and export progress. AudioContext and playback clock bookkeeping live in refs, as do mirrors of tracks and position for event callbacks.

The timeline width is based on the furthest clip end and zoom (pixels per second). Ruler labels are spaced every 30 seconds. Clip positions are represented in seconds in data and converted to pixels for display. The overview summarizes clip extents and can seek to a proportional point in the session.

## Editing interactions

- **Add track:** creates a track with a generated ID, next display name, default volume `0.8`, centered pan, and no mute/solo.
- **Rename track:** edits the name inline and marks the project unsaved.
- **Import:** selecting one or more audio files uploads and decodes them into the Media drawer. Each track has a file selector to add a chosen asset; the new clip starts after that track's last clip, or at zero on an empty track. Assets can also be dragged from the drawer onto any track; drop time is derived from pointer position and timeline scroll.
- **Move clip:** drag the clip horizontally. Start is clamped to zero.
- **Trim left:** adjusts timeline start and source offset together, preserving the selected source region's end. It cannot move before the source's beginning or leave less than 0.08 seconds.
- **Trim right:** adjusts duration, keeping at least 0.08 seconds and never extending beyond the source asset.
- **Split:** splits the selected clip at the playhead, if each resulting side is at least 0.03 seconds. The right clip advances its source offset; the split-facing fades are reset.
- **Fades:** prompts for fade duration in seconds, bounded to the clip duration. Fades are non-destructive gain ramps.
- **Remove:** removes the selected clip. Track deletion removes that track and its clips.
- **Track controls:** mute, solo, volume, and pan are used during playback and export.

Undo/redo applies to track data. The history hook keeps up to 40 past snapshots; making a new committed edit clears the redo stack. Project open resets history.

## Keyboard shortcuts

- `Space`: play or pause, except while focus is in an input or button.
- `Cmd/Ctrl + S`: save the project.
- `Delete`: remove the selected clip.

## Extending the UI safely

Keep timeline geometry in seconds in the model and convert using the current zoom only at the rendering/interaction boundary. Pass callbacks into components instead of moving project persistence or audio scheduling into presentation components. Add durable clip/track changes through the history commit path so undo/redo and unsaved state stay consistent. Add new serializable fields to the TypeScript types and ensure the backend project payload can preserve them.

The current app has a single large session controller in `App.tsx`; splitting independent behavior into focused hooks or components is appropriate as new editing capabilities are added. Keep Web Audio resources in refs and release the AudioContext when the app unmounts.
