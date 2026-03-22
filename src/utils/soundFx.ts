/**
 * Sound effects utility – lightweight, fire-and-forget audio playback.
 * Uses the Web Audio API for low-latency playback with a pre-loaded buffer cache.
 */

const cache: Record<string, AudioBuffer> = {}
let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

async function loadBuffer(url: string): Promise<AudioBuffer> {
  if (cache[url]) return cache[url]
  const res = await fetch(url)
  const arrayBuf = await res.arrayBuffer()
  const buffer = await getCtx().decodeAudioData(arrayBuf)
  cache[url] = buffer
  return buffer
}

/** Play a sound file once (volume 0-1, default 0.5). */
export function playSfx(url: string, volume = 0.5) {
  const audio = getCtx()
  // Resume context if suspended (browsers require user-gesture to start)
  if (audio.state === 'suspended') audio.resume()
  loadBuffer(url)
    .then(buffer => {
      const source = audio.createBufferSource()
      source.buffer = buffer
      const gain = audio.createGain()
      gain.gain.value = volume
      source.connect(gain).connect(audio.destination)
      source.start(0)
    })
    .catch(err => console.warn('[SFX] Failed to play', url, err))
}

// ── Pre-defined game sounds ──

const BOH_SOUND = '/assets/sounds/boh_earned.wav'

/** Play the Badge of Honor earned sound. */
export function playBohSound() {
  playSfx(BOH_SOUND, 0.6)
}
