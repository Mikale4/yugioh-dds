// Tiny Game Boy flavoured sound effects synthesised with WebAudio (no external files).
(function () {
  let ac = null, master = null, enabled = true;
  function unlock() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.12; master.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  // play a sequence of notes: [[freq, durSec, type?], ...]
  function seq(notes, vol) {
    if (!ac || !enabled) return;
    let t = ac.currentTime;
    for (const n of notes) {
      const [f, d, type] = n;
      if (f > 0) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type || "square"; o.frequency.value = f;
        g.gain.setValueAtTime(vol || 1, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.01);
      }
      t += d;
    }
  }
  function noise(dur, vol) {
    if (!ac || !enabled) return;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = vol || 0.6;
    src.connect(g); g.connect(master); src.start();
  }
  const Sfx = {
    unlock,
    get enabled() { return enabled; }, set enabled(v) { enabled = v; },
    move() { seq([[880, 0.03]], 0.5); },
    ok() { seq([[660, 0.04], [990, 0.06]], 0.7); },
    cancel() { seq([[440, 0.05], [330, 0.06]], 0.6); },
    error() { seq([[220, 0.08], [180, 0.1]], 0.7); },
    draw() { seq([[1200, 0.02], [1600, 0.03]], 0.4); },
    summon() { seq([[520, 0.05], [660, 0.05], [780, 0.08]], 0.7); },
    fuse() { seq([[400, 0.06], [600, 0.06], [800, 0.06], [1200, 0.12]], 0.8); },
    attack() { seq([[300, 0.04], [200, 0.05]], 0.8); noise(0.12, 0.5); },
    hit() { noise(0.25, 0.8); seq([[120, 0.2, "sawtooth"]], 0.6); },
    destroy() { noise(0.3, 0.7); seq([[200, 0.08], [150, 0.1], [100, 0.15]], 0.5); },
    heal() { seq([[600, 0.05], [800, 0.05], [1000, 0.05], [1200, 0.1]], 0.6); },
    damage() { seq([[240, 0.06], [200, 0.06], [160, 0.12]], 0.8); },
    magic() { seq([[900, 0.04], [1100, 0.04], [1300, 0.04], [1500, 0.04], [1700, 0.1]], 0.5); },
    trap() { seq([[500, 0.05], [350, 0.05], [500, 0.05], [350, 0.1]], 0.7); },
    win() { seq([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3], [784, 0.1], [1047, 0.4]], 0.8); },
    lose() { seq([[392, 0.2], [370, 0.2], [349, 0.2], [330, 0.5]], 0.7); },
    reward() { seq([[784, 0.08], [988, 0.08], [1175, 0.08], [1568, 0.25]], 0.7); },
    title() { seq([[523, 0.1], [0, 0.05], [523, 0.1], [784, 0.2], [659, 0.15], [523, 0.3]], 0.6); },
  };
  window.Sfx = Sfx;
})();
