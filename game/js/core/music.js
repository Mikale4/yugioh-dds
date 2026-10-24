// Background music: the original Dark Duel Stories soundtrack in audio/bgm (one HTMLAudio element at a time,
// looped, with a short fade between tracks). Browsers refuse to start audio before a key press or click, so a
// track requested early is remembered and started on the first input.
(function () {
  const TRACKS = {
    title: "01 Title", name: "02 Name Entry", menu: "03 Main Menu", campaign: "04 Campaign", prep: "05 Preparation",
    stage1: "06 Stage 1", duel1: "07 Duel - Stage 1", stage2: "08 Stage 2", duel2: "09 Duel - Stage 2",
    stage3: "10 Stage 3", duel3: "11 Duel - Stage 3", stage4: "12 Stage 4", darknite: "13 Duel - Card Demon God-DarkNite",
    stage5: "14 Stage 5", yamiyugi: "15 Duel - Dark Yugi", shadi: "16 Duel - Shadi", marik: "17 Duel - Marik Ishtar",
    yamibakura: "18 Duel - Dark Bakura", nitemare: "19 Duel - Card Demon God (True Form)-Nitemare",
    victory: "20 Victory", defeat: "21 Defeat", reward: "22 Receive Card 1 - Anzu-Téa", grandpa: "23 Receive Card 2 - Sugoroku-Solomon",
    versus: "25 Versus", records: "26 Records", password: "27 Password",
    staff: "28 Staff Roll", intro: "29 Unused 1", banlist: "30 Unused 2",
  };
  let current = null, currentName = null, pending = null, fading = null, unlocked = false;
  let enabled = true, volume = 0.6;
  // player settings shared with the rest of the game: text speed (0 slow, 1 normal, 2 fast, 3 instant) and whether
  // the enemy's turn is shown in full or fast-forwarded
  const Settings = { textSpeed: 1, fastEnemy: false };
  try {
    const s = JSON.parse(localStorage.getItem("dds_settings") || "{}");
    if (s.music === false) enabled = false; if (typeof s.musicVol === "number") volume = s.musicVol; if (s.sfx === false && window.Sfx) Sfx.enabled = false;
    if (typeof s.textSpeed === "number") Settings.textSpeed = s.textSpeed; if (s.fastEnemy) Settings.fastEnemy = true;
  } catch (e) { }
  function saveSettings() { try { localStorage.setItem("dds_settings", JSON.stringify({ music: enabled, musicVol: volume, sfx: window.Sfx ? Sfx.enabled : true, textSpeed: Settings.textSpeed, fastEnemy: Settings.fastEnemy })); } catch (e) { } }
  Settings.save = saveSettings;
  Settings.TEXT_NAMES = ["Slow", "Normal", "Fast", "Instant"];
  Settings.textMul = () => [0.5, 1, 2, 99][Settings.textSpeed] || 1;   // typewriter characters per frame, relative
  Settings.stepMul = () => [1.4, 1, 0.55, 0.2][Settings.textSpeed] || 1; // how long each duel narration step stays
  window.Settings = Settings;

  function src(name) { return "audio/bgm/" + encodeURIComponent(TRACKS[name] + ".mp3"); }
  function startNow(name, loop) {
    const a = new Audio(src(name));
    a.loop = loop !== false; a.volume = volume;
    current = a; currentName = name;
    const p = a.play();
    // a rejected play() only matters if this element is still the current track (a track faded out before its
    // play() resolved rejects with AbortError - that one is simply gone); autoplay refusals go back to pending
    if (p && p.catch) p.catch((err) => { if (current !== a) return; current = null; currentName = null; if (!err || err.name !== "AbortError") pending = { name, loop }; });
  }
  function fadeOutAndStop(a) {
    if (!a) return;
    if (fading) { try { fading.pause(); } catch (e) { } }
    fading = a;
    const step = () => {
      if (fading !== a) return;
      a.volume = Math.max(0, a.volume - 0.08);
      if (a.volume <= 0.01) { try { a.pause(); } catch (e) { } fading = null; } else setTimeout(step, 30);
    };
    setTimeout(step, 30);
  }
  const Music = {
    // switch to a track (no-op if it is already playing); loop defaults to true
    play(name, loop) {
      if (!TRACKS[name]) return;
      if (currentName === name && current && !current.paused) return;
      if (currentName === name && pending) return;
      if (!enabled) { pending = { name, loop }; return; }
      if (!unlocked) { pending = { name, loop }; return; }
      if (current) fadeOutAndStop(current);
      pending = null;
      startNow(name, loop);
    },
    stop() { if (current) fadeOutAndStop(current); current = null; currentName = null; pending = null; },
    // called from the first user input
    unlock() {
      unlocked = true;
      if (!enabled) return; // the pending track starts when music is switched back on
      if (pending && !current) { const p = pending; pending = null; startNow(p.name, p.loop); }
      pending = null; // anything else queued while a track was already playing is stale
    },
    get enabled() { return enabled; },
    set enabled(v) {
      enabled = !!v; saveSettings();
      if (!enabled) { if (current) { pending = { name: currentName, loop: current.loop }; fadeOutAndStop(current); current = null; currentName = null; } }
      else if (pending && unlocked) { const p = pending; pending = null; startNow(p.name, p.loop); }
    },
    get volume() { return volume; },
    set volume(v) { volume = Math.max(0, Math.min(1, v)); if (current) current.volume = volume; saveSettings(); },
    get current() { return currentName; },
    saveSettings,
  };
  window.Music = Music;
})();
