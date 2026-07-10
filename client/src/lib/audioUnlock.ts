/** Tarayıcı autoplay kilidini kullanıcı tıklaması sırasında açar (sesli kanala girerken). */
let unlocked = false;

export async function unlockAudioPlayback(): Promise<void> {
  if (unlocked) return;

  try {
    const ctx = new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    await ctx.close();
  } catch {
    /* ignore */
  }

  try {
    const el = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
    );
    el.volume = 0.001;
    await el.play();
  } catch {
    /* ignore */
  }

  unlocked = true;
}

export function isAudioUnlocked() {
  return unlocked;
}
