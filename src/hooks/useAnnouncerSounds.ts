/**
 * Kill Streak Announcer Sounds
 * 
 * - "firstblood": once per battle, when any side hits 0.73+ ratio, only after 5 min
 * - "holyshit":   once per round, when any side hits 0.85+ ratio, only after 5 min
 * - At 0.90+:     random pick from monsterkill/mega-kill/ultrakill, once per round
 */

const soundCache: Record<string, HTMLAudioElement> = {}

function getSound(name: string): HTMLAudioElement {
  if (!soundCache[name]) {
    soundCache[name] = new Audio(`/assets/sounds/${name}.mp3`)
    soundCache[name].volume = 0.7
  }
  return soundCache[name]
}

export type AnnouncerTier = 'firstblood' | 'ultrakill' | 'monsterkill' | 'mega-kill' | 'holyshit'

const RANDOM_SOUNDS: AnnouncerTier[] = ['ultrakill', 'monsterkill', 'mega-kill']

function playSound(tier: AnnouncerTier) {
  try {
    const audio = getSound(tier)
    audio.currentTime = 0
    audio.play().catch(() => {})
  } catch {
    // Audio not available
  }
}

// Keys stored: "firstblood", "holyshit_R3", "random90_R3"
export type AnnouncerPlayed = Set<string>

const globalAnnouncerState = new Map<string, AnnouncerPlayed>()

/**
 * @param battleId       - ID of the battle
 * @param isOwnBattle    - whether the player's country is involved in this battle
 * @param ratio          - damageRatio (0 = def dominating, 1 = atk dominating)
 * @param battleAgeMs    - milliseconds since battle started
 * @param currentRound   - current round number (1-based)
 */
export function checkAnnouncerThresholds(
  battleId: string,
  isOwnBattle: boolean,
  ratio: number,
  battleAgeMs: number,
  currentRound: number,
) {
  // Only play on own battles
  if (!isOwnBattle) return

  // Only trigger after 5 minutes (300,000 ms)
  if (battleAgeMs < 300_000) return

  let played = globalAnnouncerState.get(battleId)
  if (!played) {
    played = new Set()
    globalAnnouncerState.set(battleId, played)
  }

  // The "domination" value: how far either side is from center
  // ratio=0.73 → maxDom=0.73, ratio=0.27 → maxDom=0.73 (defender)
  const maxDom = Math.max(ratio, 1 - ratio)

  // FIRSTBLOOD — once per entire battle
  if (maxDom >= 0.73 && !played.has('firstblood')) {
    played.add('firstblood')
    playSound('firstblood')
    return
  }

  // HOLYSHIT — once per round
  const holyKey = `holyshit_R${currentRound}`
  if (maxDom >= 0.85 && !played.has(holyKey)) {
    played.add(holyKey)
    playSound('holyshit')
    return
  }

  // 0.90+ — random sound, once per round
  const randKey = `random90_R${currentRound}`
  if (maxDom >= 0.90 && !played.has(randKey)) {
    played.add(randKey)
    const pick = RANDOM_SOUNDS[Math.floor(Math.random() * RANDOM_SOUNDS.length)]
    playSound(pick)
    return
  }
}
