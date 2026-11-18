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
