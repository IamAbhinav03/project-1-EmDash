# Audio, clips, playback, and projects

## Browser audio model

Audio work happens in the browser using the Web Audio API. An imported source is uploaded to the backend, downloaded by its returned URL, and decoded with `AudioContext.decodeAudioData`. The decoded `AudioBuffer` stays in React runtime state. This allows immediate waveform rendering, playback, and export without asking the backend to decode or mix audio.

Waveforms are drawn in `components/Waveform.tsx` on a canvas. It reads channel zero, samples the clip's source region (`offset` plus `duration`), and draws a min/max vertical range for each horizontal pixel. It is a visual summary, not a destructive audio edit.

## Clip coordinates

A clip uses two coordinate spaces:

- `start`: start time in the project timeline, in seconds.
- `offset`: start time within the source asset, in seconds.
- `duration`: length of the source segment and timeline clip, in seconds.

Thus a clip plays source audio `[offset, offset + duration)` at project time `[start, start + duration)`. Fades are lengths in seconds and are applied as gain ramps at the clip boundaries. Track volume and pan are applied downstream of the clip source.

## Playback graph

For each audible clip, `App.schedule` creates an `AudioBufferSourceNode`, `GainNode`, and `StereoPannerNode`, connected in that order to the AudioContext destination. It schedules clips relative to the current playhead and current AudioContext time. It skips clips ending before the playhead and offsets the source start for clips already in progress. Track mute and solo determine which tracks are scheduled. Per-clip fades are represented by scheduled gain automation.

The playhead UI is advanced with `requestAnimationFrame` using AudioContext time as the clock. Pause records the calculated current position and suspends the context. Seeking clamps to the project extent and restarts playback if playback was active. At the end of the timeline playback stops. The code contains a loop branch, but the loop flag initializes false and there is no current UI toggle to turn it on.

## Export

Export uses `OfflineAudioContext` to render the full project extent to a stereo buffer at the active AudioContext sample rate, or 44.1 kHz when there is no active context. It applies mute/solo, volume, pan, clip source offsets, durations, and fade ramps. `encodeWav` in `audio.ts` writes a standard RIFF/WAVE header and interleaved signed 16-bit PCM samples. The browser downloads the resulting `.wav` file using a filename based on the project name.

Long renders can consume significant memory because the output buffer is held in browser memory. The app reports export failure with a shorter-session suggestion when rendering throws. Export does not create an asset or save the resulting mix to the backend.

## Save and reopen

The project manager removes `buffer` from each asset before sending project data to the backend. The saved representation contains metadata and track/clip parameters, not the audio bytes or decoded samples. Audio bytes live separately as files in `backend/data/assets/`.

Opening a project first reads its JSON, then downloads and decodes each asset URL. If an asset file has been removed, opening cannot reconstruct that source and the UI reports an error. Runtime state is marked saved after a successful open. Imported files are stored by the backend even before a project is saved; no asset deletion/garbage-collection endpoint currently exists.
