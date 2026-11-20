let audioContext: AudioContext | null = null;

export function playFeedbackSound(correct: boolean) {
  if (typeof window === "undefined") return;
  const Context = window.AudioContext;
  if (!Context) return;
  try {
    audioContext ??= new Context();
    if (audioContext.state === "suspended") void audioContext.resume();
    const now = audioContext.currentTime;
    const notes = correct ? [523.25, 659.25, 783.99] : [392, 311.13];
    notes.forEach((frequency, index) => {
      const start = now + index * (correct ? 0.075 : 0.09);
      const oscillator = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(correct ? 0.075 : 0.048, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (correct ? 0.2 : 0.16));
      oscillator.connect(gain);
      gain.connect(audioContext!.destination);
      oscillator.start(start);
      oscillator.stop(start + (correct ? 0.21 : 0.17));
    });
  } catch {
    // Sound is optional: keep the exercise usable if Web Audio is unavailable.
  }
}

export function playWheelSpinSound(durationMs = 1900) {
  if (typeof window === "undefined" || !window.AudioContext) return;
  try {
    audioContext ??= new window.AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume();
    const steps = 17;
    const weights = Array.from({ length: steps }, (_, index) => 1 + index * 0.16);
    const total = weights.reduce((sum, value) => sum + value, 0);
    let elapsed = 0;
    weights.forEach((weight, index) => {
      const start = audioContext!.currentTime + (elapsed / total) * (durationMs / 1000);
      const oscillator = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(820 - index * 23, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.035);
      oscillator.connect(gain);
      gain.connect(audioContext!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.04);
      elapsed += weight;
    });
  } catch {
    // Sound is optional: keep the exercise usable if Web Audio is unavailable.
  }
}

export function playPairIntroTone(step: number) {
  if (typeof window === "undefined" || !window.AudioContext) return;
  try {
    audioContext ??= new window.AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume();
    const now = audioContext.currentTime;
    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 659.25, 783.99];
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(melody[step % melody.length], now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.19);
  } catch {
    // Sound is optional: keep the exercise usable if Web Audio is unavailable.
  }
}
