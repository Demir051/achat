export type SoundId =
  | "voiceJoin"
  | "voiceLeave"
  | "screenShareStart"
  | "screenShareStop"
  | "mute"
  | "unmute";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  destination: AudioNode
) {
  const osc = getCtx().createOscillator();
  const gain = getCtx().createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playSound(id: SoundId) {
  try {
    const audio = getCtx();
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.value = 0.22;
    master.connect(audio.destination);

    switch (id) {
      case "voiceJoin":
        tone(392, now, 0.1, "sine", 0.5, master);
        tone(523.25, now + 0.09, 0.14, "sine", 0.45, master);
        tone(659.25, now + 0.2, 0.18, "sine", 0.35, master);
        break;
      case "voiceLeave":
        tone(659.25, now, 0.1, "sine", 0.4, master);
        tone(523.25, now + 0.1, 0.12, "sine", 0.35, master);
        tone(392, now + 0.2, 0.2, "sine", 0.3, master);
        break;
      case "screenShareStart":
        tone(880, now, 0.06, "triangle", 0.35, master);
        tone(1174.66, now + 0.07, 0.1, "triangle", 0.3, master);
        tone(1318.51, now + 0.15, 0.14, "triangle", 0.25, master);
        break;
      case "screenShareStop":
        tone(1318.51, now, 0.08, "triangle", 0.3, master);
        tone(987.77, now + 0.1, 0.14, "triangle", 0.25, master);
        break;
      case "mute":
        tone(330, now, 0.08, "square", 0.12, master);
        break;
      case "unmute":
        tone(440, now, 0.08, "sine", 0.25, master);
        break;
    }
  } catch {
    /* ses çalınamadı */
  }
}
