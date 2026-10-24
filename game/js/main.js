// Screen stack + main loop.
(function () {
  const Game = {
    stack: [], fading: 0, fadeDir: 0, pending: null, frame: 0,
    push(s, params) { if (this.top && this.top.pause) this.top.pause(); this.stack.push(s); if (s.enter) s.enter(params || {}); },
    pop(result) { const s = this.stack.pop(); if (s && s.exit) s.exit(); const t = this.top; if (t && t.resume) t.resume(result); },
    replace(s, params) { const old = this.stack.pop(); if (old && old.exit) old.exit(); this.stack.push(s); if (s.enter) s.enter(params || {}); },
    get top() { return this.stack[this.stack.length - 1]; },
    // fade to black, run fn (which changes screens), fade back in
    transition(fn, speed) { this.pending = fn; this.fadeDir = 1; this.fadeSpeed = speed || 0.1; },
    goto(s, params) { this.transition(() => { while (this.stack.length) { const o = this.stack.pop(); if (o.exit) o.exit(); } this.push(s, params); }); },
  };
  window.Game = Game;

  function update() {
    if (Game.fadeDir !== 0) {
      G.fadeLevel += Game.fadeDir * Game.fadeSpeed;
      if (Game.fadeDir > 0 && G.fadeLevel >= 1) { G.fadeLevel = 1; if (Game.pending) { const f = Game.pending; Game.pending = null; f(); } Game.fadeDir = -1; }
      else if (Game.fadeDir < 0 && G.fadeLevel <= 0) { G.fadeLevel = 0; Game.fadeDir = 0; }
      Input.consumeAll();
      return;
    }
    const t = Game.top;
    if (t && t.update) t.update();
  }
  function draw() {
    G.clear("#000");
    // draw overlay screens on top of the one below them
    let i = Game.stack.length - 1;
    while (i > 0 && Game.stack[i].overlay) i--;
    for (; i < Game.stack.length; i++) if (Game.stack[i].draw) Game.stack[i].draw();
    G.applyFade();
  }
  let last = 0, acc = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!Assets.ready) return;
    const dt = Math.min(100, ts - last); last = ts; acc += dt;
    let steps = 0;
    while (acc >= 1000 / 60 && steps < 4) { update(); Input.endFrame(); acc -= 1000 / 60; steps++; G.frame++; }
    if (steps === 0 && acc > 1000) acc = 0;
    draw();
  }
  // test hooks: advance n frames manually (useful when the tab is hidden and rAF is throttled)
  Game.tick = function (n) { for (let i = 0; i < (n || 1); i++) { update(); Input.endFrame(); G.frame++; } draw(); };
  Game.press = function (name, frames) { Input.inject(name); Game.tick(frames || 2); };
  Game.click = function (x, y, frames) { Input.injectClick(x, y); Game.tick(frames || 2); };
  Assets.load().then(() => {
    Game.push(Screens.boot());
    requestAnimationFrame((ts) => { last = ts; loop(ts); });
  });
})();
