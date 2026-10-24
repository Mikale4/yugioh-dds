// Reusable UI widgets drawn with the bitmap font: menus, scrolling lists, message boxes, card info panels.
(function () {
  const C = G.C;

  // ---------------------------------------------------------------- Menu (vertical option list)
  class Menu {
    constructor(items, opts) {
      this.items = items; // [{label, value, disabled?}]
      this.sel = 0; this.opts = opts || {};
      this.x = this.opts.x || 0; this.y = this.opts.y || 0;
      // never narrower than the longest label (cursor column + text + padding)
      const need = Math.max(0, ...items.map((i) => i.label.length)) * 8 + 20;
      this.w = Math.max(this.opts.w || 0, need);
      if (this.x + this.w > 160) this.x = Math.max(0, 160 - this.w);
      this.lineH = this.opts.lineH || 10;
      this.h = this.opts.h || (items.length * this.lineH + 10);
      this.style = this.opts.style || "menu";
      this.textColor = this.opts.textColor || (this.style === "menu" || this.style === "talk" ? C.white : C.black);
      this.cols = this.opts.cols || 1;
    }
    get value() { return this.items[this.sel] && this.items[this.sel].value; }
    // returns 'ok' | 'cancel' | null
    update() {
      const n = this.items.length; if (!n) return Input.pressed("b") ? "cancel" : null;
      const rows = Math.ceil(n / this.cols);
      if (Input.pressed("up")) { this.sel = (this.sel - this.cols + n) % n; Sfx.move(); }
      if (Input.pressed("down")) { this.sel = (this.sel + this.cols) % n; Sfx.move(); }
      if (this.cols > 1) {
        if (Input.pressed("left")) { this.sel = (this.sel - 1 + n) % n; Sfx.move(); }
        if (Input.pressed("right")) { this.sel = (this.sel + 1) % n; Sfx.move(); }
      }
      if (Input.wheel) { this.sel = (this.sel + Math.sign(Input.wheel) + n) % n; }
      // mouse
      const colW = Math.floor((this.w - 8) / this.cols);
      for (let i = 0; i < n; i++) {
        const cx = this.x + 4 + (i % this.cols) * colW, cy = this.y + 5 + Math.floor(i / this.cols) * this.lineH;
        if (Input.over(cx, cy - 1, colW, this.lineH)) {
          if (Input.hover && (Input.hover.x !== this._hx || Input.hover.y !== this._hy)) { this.sel = i; this._hx = Input.hover.x; this._hy = Input.hover.y; }
          if (Input.click) { this.sel = i; if (this.items[i].disabled) { Sfx.error(); return null; } Sfx.ok(); return "ok"; }
        }
      }
      if (Input.pressed("a")) { if (this.items[this.sel].disabled) { Sfx.error(); return null; } Sfx.ok(); return "ok"; }
      if (Input.pressed("b")) { Sfx.cancel(); return "cancel"; }
      // click outside cancels
      if (Input.click && !Input.over(this.x, this.y, this.w, this.h) && this.opts.clickOutsideCancels) { Sfx.cancel(); return "cancel"; }
      return null;
    }
    draw() {
      if (this.style !== "none") G.box(this.x, this.y, this.w, this.h, this.style);
      const colW = Math.floor((this.w - 8) / this.cols);
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        const cx = this.x + 4 + (i % this.cols) * colW, cy = this.y + 5 + Math.floor(i / this.cols) * this.lineH;
        const col = it.disabled ? C.gray : (it.color || this.textColor);
        G.text(cx + 10, cy, it.label, col);
        if (i === this.sel) G.text(cx + 1, cy, ">", this.opts.cursorColor || C.gold);
      }
      if (this.opts.title) G.text(this.x + 4, this.y - 9, this.opts.title, C.white);
    }
  }

  // ---------------------------------------------------------------- ListView (scrolling list)
  class ListView {
    constructor(opts) {
      this.x = opts.x; this.y = opts.y; this.w = opts.w; this.h = opts.h;
      this.rows = opts.rows; this.lineH = opts.lineH || 8;
      this.items = opts.items || []; this.sel = 0; this.top = 0;
      this.render = opts.render; // (item, x, y, selected, index) => void
      this.style = opts.style || "list";
    }
    setItems(items) { this.items = items; if (this.sel >= items.length) this.sel = Math.max(0, items.length - 1); this.clamp(); }
    clamp() { if (this.sel < this.top) this.top = this.sel; if (this.sel >= this.top + this.rows) this.top = this.sel - this.rows + 1; if (this.top < 0) this.top = 0; }
    get item() { return this.items[this.sel]; }
    update() {
      const n = this.items.length;
      if (n) {
        if (Input.pressed("up")) { this.sel = (this.sel - 1 + n) % n; Sfx.move(); }
        if (Input.pressed("down")) { this.sel = (this.sel + 1) % n; Sfx.move(); }
        if (Input.pressed("left")) { this.sel = Math.max(0, this.sel - this.rows); Sfx.move(); }
        if (Input.pressed("right")) { this.sel = Math.min(n - 1, this.sel + this.rows); Sfx.move(); }
        if (Input.wheel) { this.top = Math.max(0, Math.min(Math.max(0, n - this.rows), this.top + Input.wheel)); if (this.sel < this.top) this.sel = this.top; if (this.sel >= this.top + this.rows) this.sel = this.top + this.rows - 1; }
        this.clamp();
        for (let r = 0; r < this.rows; r++) {
          const i = this.top + r; if (i >= n) break;
          const ry = this.y + 3 + r * this.lineH;
          if (Input.over(this.x, ry, this.w, this.lineH)) {
            if (Input.hover.x !== this._hx || Input.hover.y !== this._hy) { this.sel = i; this._hx = Input.hover.x; this._hy = Input.hover.y; }
            if (Input.click) { this.sel = i; Sfx.ok(); return "ok"; }
          }
        }
        // scrollbar arrows
        if (Input.hit(this.x + this.w - 8, this.y, 8, 8)) { this.sel = Math.max(0, this.sel - 1); this.clamp(); }
        if (Input.hit(this.x + this.w - 8, this.y + this.h - 8, 8, 8)) { this.sel = Math.min(n - 1, this.sel + 1); this.clamp(); }
      }
      if (Input.pressed("a") && n) { Sfx.ok(); return "ok"; }
      if (Input.pressed("b")) { Sfx.cancel(); return "cancel"; }
      return null;
    }
    draw() {
      if (this.style !== "none") G.box(this.x, this.y, this.w, this.h, this.style);
      const n = this.items.length;
      for (let r = 0; r < this.rows; r++) {
        const i = this.top + r; if (i >= n) break;
        const ry = this.y + 3 + r * this.lineH;
        if (i === this.sel) G.fill(this.x + 2, ry, this.w - 4, this.lineH, this.style === "list" ? "#c8e8ff" : "#284888"); // exactly the 8px glyph row
        this.render(this.items[i], this.x + 4, ry, i === this.sel, i);
      }
      if (n > this.rows) { // scroll bar along the right edge (rows keep the space left of it)
        const barH = this.h - 6, thumb = Math.max(4, Math.floor(barH * this.rows / n));
        const pos = Math.floor((barH - thumb) * this.top / Math.max(1, n - this.rows));
        G.fill(this.x + this.w - 3, this.y + 3, 1, barH, C.gray); G.fill(this.x + this.w - 4, this.y + 3 + pos, 3, thumb, C.darkgray);
      }
      if (!n) G.text(this.x + 6, this.y + 4, "(empty)", C.gray);
    }
  }

  // ---------------------------------------------------------------- MessageBox (typewriter dialog)
  class MessageBox {
    constructor(opts) {
      opts = opts || {};
      this.x = opts.x === undefined ? 2 : opts.x; this.y = opts.y === undefined ? 92 : opts.y;
      this.w = opts.w || 156; this.h = opts.h || 50; this.style = opts.style || "talk";
      this.color = opts.color || C.white; this.cols = Math.floor((this.w - 12) / 8); this.linesPerPage = opts.lines || Math.floor((this.h - 10) / 8);
      this.pages = []; this.page = 0; this.shown = 0; this.done = false;
      const mul = window.Settings ? Settings.textMul() : 1;
      this.speed = (opts.speed || 2) * mul; this.instant = !!opts.instant || mul > 10;
      if (opts.text) this.setText(opts.text);
    }
    setText(text) {
      const lines = G.wrap(text, this.cols);
      this.pages = []; for (let i = 0; i < lines.length; i += this.linesPerPage) this.pages.push(lines.slice(i, i + this.linesPerPage));
      if (!this.pages.length) this.pages.push([""]);
      this.page = 0; this.shown = 0; this.done = false;
    }
    get pageChars() { return this.pages[this.page].reduce((s, l) => s + l.length, 0); }
    get finished() { return this.done; }
    // returns true when the player dismissed the final page
    update() {
      if (this.done) return true;
      const total = this.pageChars;
      if (this.shown < total) {
        this.shown += this.instant ? total : this.speed;
        if (Input.pressed("a") || Input.click) { this.shown = total; Input.consume("a"); Input.click = null; }
        return false;
      }
      if (Input.pressed("a") || Input.click || Input.pressed("b")) {
        Input.consume("a"); Input.consume("b"); Input.click = null;
        if (this.page < this.pages.length - 1) { this.page++; this.shown = 0; Sfx.ok(); } else { this.done = true; return true; }
      }
      return false;
    }
    draw() {
      G.box(this.x, this.y, this.w, this.h, this.style);
      let left = this.shown;
      const lines = this.pages[this.page];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]; const n = Math.max(0, Math.min(l.length, left)); left -= n;
        G.text(this.x + 6, this.y + 6 + i * 8, l.slice(0, n), this.color);
      }
      if (this.shown >= this.pageChars && G.blink(20)) { if (this.page < this.pages.length - 1) G.tri(this.x + this.w - 13, this.y + this.h - 8, "down", this.color); else G.text(this.x + this.w - 14, this.y + this.h - 10, "\x8c", this.color); }
    }
  }

  // ---------------------------------------------------------------- Card info drawing helpers
  const detail = { id: null, page: 0, pages: 1 }; // which text page of the card page is open
  const UI = {
    Menu, ListView, MessageBox,
    // small "name / ATK / DEF / element / stars" block as in the duel screen
    cardStats(x, y, c, statsOverride, color) {
      color = color || C.black;
      G.text(x, y, c.name.slice(0, 8), color);
      if (c.kind === "M") {
        const a = statsOverride ? statsOverride.atk : c.atk, d = statsOverride ? statsOverride.def : c.def;
        Assets.icon("atk", x + 4, y + 8, color); G.textR(x + 64, y + 8, a, color);
        Assets.icon("def", x + 4, y + 16, color); G.textR(x + 64, y + 16, d, color);
        G.text(x, y + 25, c.el, color);
      } else {
        G.text(x, y + 12, CardDB.kindName(c), color);
      }
    },
    // full card detail page (used by chest, deck, rewards)
    cardDetail(id, opts) {
      opts = opts || {};
      const c = CardDB.get(id); if (!c) return;
      G.fill(0, 0, 160, 144, C.yellow);
      G.rect(0, 0, 160, 144, C.black);
      // name: up to two lines of 19 characters
      const nameLines = G.wrap(c.name, 19).slice(0, 2);
      G.text(4, 3, nameLines[0], C.black);
      if (nameLines[1]) G.text(4, 11, nameLines[1], C.black);
      Assets.drawCard(id, 6, 20);
      const x = 78;
      if (c.kind === "M") {
        G.text(x, 31, "No." + id, C.black);
        G.text(x, 40, Banlist.label(id) || "Max 3", Banlist.ritualOnly(id) ? C.purple : Banlist.limit(id) === 3 ? C.black : C.red);
        const live = opts.live; // a monster on the field: its current ATK / DEF, boosts and all
        Assets.icon("atk", x, 50); G.textR(156, 50, live ? live.atk : c.atk, live && live.atk !== c.atk ? C.red : C.black);
        Assets.icon("def", x, 59); G.textR(156, 59, live ? live.def : c.def, live && live.def !== c.def ? C.red : C.black);
        if (live && live.atk !== c.atk) G.text(x, 88, "was " + c.atk, C.darkgray);          // the printed stats, for comparison
        if (live && live.def !== c.def) G.text(x, 96, "was " + c.def, C.darkgray);
        G.text(x, 70, c.ty, C.black);
        G.text(x, 79, c.el, C.black);
      } else {
        G.text(x, 31, "No." + id, C.black);
        G.text(x, 40, Banlist.label(id) || "Max 3", Banlist.limit(id) === 3 ? C.black : C.red);
        G.text(x, 56, CardDB.kindName(c), C.black);
      }
      if (Banlist.ritualOnly(id)) G.text(x, 90, Save.hasSummoned(id) ? "Summoned" : "Not yet", Save.hasSummoned(id) ? C.purple : C.darkgray);
      else if (opts.owned !== undefined) G.text(x, 90, "Own " + opts.owned + (opts.inDeck !== undefined ? " Dk " + opts.inDeck : ""), C.black);
      // text box: pages of up to 4 lines, left/right to turn (arrows show when there is more)
      G.box(0, 102, 160, 42, "card");
      const pages = UI.detailPages(id);
      if (detail.id !== id) { detail.id = id; detail.page = 0; }
      detail.pages = pages.length;
      if (detail.page >= pages.length) detail.page = Math.max(0, pages.length - 1);
      const rows = pages[detail.page] ? pages[detail.page].slice() : [];
      if (opts.footer) rows.splice(3, 1, { t: opts.footer, col: C.black });
      for (let i = 0; i < Math.min(4, rows.length); i++) G.text(6, 106 + i * 9, rows[i].t, rows[i].col);
      if (detail.page > 0) G.tri(3, 135, "left", C.darkgray);
      if (detail.page < pages.length - 1) G.tri(152, 135, "right", C.darkgray);
    },
    // the text pages of a card: flavour text, then the SPCL ability on its own page, then for a ritual offering
    // a page naming the ritual card that wants it
    detailPages(id) {
      const c = CardDB.get(id); if (!c) return [[]];
      const pages = [];
      const black = (lines) => lines.map((t) => ({ t, col: C.black }));
      if (c.kind === "M") {
        pages.push(black(G.wrap(c.desc || "", 18).slice(0, 4)));
        const how = Effects.summonHow(id);
        if (how) pages.push(G.wrap(how, 18).slice(0, 4).map((t) => ({ t, col: C.purple })));
        if (Effects.passive[id]) pages.push(G.wrap("Effect: " + Effects.passive[id], 18).slice(0, 4).map((t) => ({ t, col: "#804000" })));
        if (Effects.special[id]) pages.push(G.wrap("SPCL: " + Effects.special[id].text, 18).slice(0, 4).map((t) => ({ t, col: "#804000" })));
        if (Effects.special2[id]) pages.push(G.wrap("SPCL 2: " + Effects.special2[id].text, 18).slice(0, 4).map((t) => ({ t, col: "#804000" })));
        const rituals = Object.keys(Effects.ritual).filter((sid) => Effects.ritual[sid].need.includes(id)).map((sid) => CardDB.get(Number(sid)).name);
        if (rituals.length) pages.push(G.wrap("Used in " + rituals.join(", "), 18).slice(0, 4).map((t) => ({ t, col: C.purple })));
      } else {
        pages.push(black(G.wrap(Effects.text(id) || c.desc || "", 18).slice(0, 4)));
      }
      return pages;
    },
    // call from the screen that shows a card page: turns pages on left/right (or a click on an arrow); true when it did
    detailInput() {
      if (detail.pages <= 1) return false;
      let d = 0;
      if (Input.pressed("right") || Input.hit(140, 126, 20, 18)) d = 1;
      else if (Input.pressed("left") || Input.hit(0, 126, 20, 18)) d = -1;
      if (!d) return false;
      const np = Math.max(0, Math.min(detail.pages - 1, detail.page + d));
      if (np !== detail.page) { detail.page = np; Sfx.move(); }
      Input.consumeAll();
      return true;
    },
    // yes/no prompt
    confirm(opts) {
      const m = new Menu([{ label: "Yes", value: true }, { label: "No", value: false }], { x: opts.x === undefined ? 96 : opts.x, y: opts.y === undefined ? 100 : opts.y, w: 56, style: "menu" });
      m.sel = opts.defaultNo ? 1 : 0; m.question = opts.text;
      return m;
    },
    // header bar with the player's stats
    statusBar(y) {
      const d = Save.data;
      G.box(0, y, 160, 14, "duel");
      G.text(4, y + 3, d.name.slice(0, 8), C.black);
      G.textR(156, y + 3, "W" + d.stats.wins + " L" + d.stats.losses, C.black);
    },
  };
  window.UI = UI;
})();
