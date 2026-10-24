export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels, frames = buffer.length, size = frames * channels * 2
  const bytes = new ArrayBuffer(44 + size), view = new DataView(bytes)
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + size, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, size, true)
  let offset = 44
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame]))
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2
  }
  return new Blob([bytes], { type: 'audio/wav' })
}
