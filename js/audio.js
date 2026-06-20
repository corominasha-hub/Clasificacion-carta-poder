/**
 * SocioCheck AI - Audio Feedback Module (Web Audio API)
 */

export function playSuccessChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Note 1 (E5)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
        gain1.gain.setValueAtTime(0.0, audioCtx.currentTime);
        gain1.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc1.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 0.35);

        // Note 2 (A5) - delayed slightly
        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime); // A5
            gain2.gain.setValueAtTime(0.0, audioCtx.currentTime);
            gain2.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
            osc2.start(audioCtx.currentTime);
            osc2.stop(audioCtx.currentTime + 0.45);
        }, 80);

    } catch (e) {
        console.warn("Web Audio API not supported or user interaction required:", e);
    }
}

export function playWarningBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Osc 1 (Low Alert Tone)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(140, audioCtx.currentTime);
        gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc1.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 0.35);

        // Osc 2 (Slightly delayed second tone for urgency)
        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(95, audioCtx.currentTime);
            gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            osc2.start(audioCtx.currentTime);
            osc2.stop(audioCtx.currentTime + 0.4);
        }, 120);
    } catch (e) {
        console.warn("Web Audio API not supported or user interaction required:", e);
    }
}
