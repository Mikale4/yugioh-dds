// Keyboard (Game Boy style buttons) + mouse/touch mapped to the 160x144 logical screen.
(function () {
  const KEYMAP = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
    z: "a", Z: "a", Enter: "a", x: "b", X: "b", Escape: "b", Backspace: "b",
    "`": "select", "~": "select", c: "start", C: "start", " ": "sort", Tab: "filter",
  };
  const held = {}, pressedNow = {}, repeatTimer = {};
  const Input = {
    click: null, hover: { x: -1, y: -1 }, wheel: 0, anyKey: false,
    pressed(name) { return !!pressedNow[name]; },
    held(name) { return !!held[name]; },
    consume(name) { pressedNow[name] = false; },
    consumeAll() { for (const k in pressedNow) pressedNow[k] = false; Input.click = null; Input.wheel = 0; },
    // true if the mouse was clicked inside the rect this frame
    hit(x, y, w, h) { const c = Input.click; return !!c && c.x >= x && c.y >= y && c.x < x + w && c.y < y + h; },
    over(x, y, w, h) { const c = Input.hover; return c.x >= x && c.y >= y && c.x < x + w && c.y < y + h; },
  };

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && window.Demo && Demo.available()) { e.preventDefault(); if (!e.repeat) Demo.toggle(); return; }
    const n = KEYMAP[e.key];
    if (n) {
      e.preventDefault();
      if (!held[n]) { pressedNow[n] = true; repeatTimer[n] = 0; }
      held[n] = true;
    }
    Input.anyKey = true;
    if (window.Sfx && window.Sfx.unlock) window.Sfx.unlock();
    if (window.Music) window.Music.unlock();
  });
  window.addEventListener("keyup", (e) => { const n = KEYMAP[e.key]; if (n) { held[n] = false; } });
  window.addEventListener("blur", () => { for (const k in held) held[k] = false; });

  const canvas = document.getElementById("screen");
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * 160);
    const y = Math.floor((e.clientY - r.top) / r.height * 144);
    return { x, y };
  }
  canvas.addEventListener("mousemove", (e) => { Input.hover = toLogical(e); });
  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (window.Sfx && window.Sfx.unlock) window.Sfx.unlock();
    if (window.Music) window.Music.unlock();
    if (e.button === 2) { pressedNow.b = true; return; }
    Input.click = toLogical(e); Input.hover = Input.click;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); Input.wheel += Math.sign(e.deltaY); }, { passive: false });
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (window.Sfx && window.Sfx.unlock) window.Sfx.unlock();
    if (window.Music) window.Music.unlock();
    const t = e.changedTouches[0];
    Input.click = toLogical(t); Input.hover = Input.click;
  }, { passive: false });

  Input.inject = function (name) { pressedNow[name] = true; };
  Input.injectClick = function (x, y) { Input.click = { x, y }; Input.hover = { x, y }; };
  // called once per frame after the game has processed input
  Input.endFrame = function () {
    for (const k in pressedNow) pressedNow[k] = false;
    Input.click = null; Input.wheel = 0; Input.anyKey = false;
    // key auto-repeat for directions
    for (const n of ["up", "down", "left", "right"]) {
      if (held[n]) {
        repeatTimer[n] = (repeatTimer[n] || 0) + 1;
        if (repeatTimer[n] > 14 && (repeatTimer[n] - 14) % 4 === 0) pressedNow[n] = true;
      }
    }
  };
  window.Input = Input;
})();
