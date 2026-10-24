// Low-level drawing: a 160x144 canvas scaled up with pixel-perfect nearest filtering,
// the ripped DDS bitmap font, and the panel/box styles used throughout the game.
(function () {
  const W = 160, H = 144;
  const canvas = document.getElementById("screen");
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const G = {
    W, H, canvas, ctx, scale: 4, frame: 0,
    // palette
    C: {
      black: "#000000", white: "#f8f8f8", panel: "#a8e8f8", panelDark: "#58a8c8", border: "#a05820",
      yellow: "#f8f0a0", yellowDark: "#c8b860", blue: "#1848c8", blueLight: "#68a8f8", navy: "#000838",
      red: "#f83030", green: "#38c848", gray: "#787888", darkgray: "#404050", gold: "#f8d020",
      orange: "#f89020", purple: "#8838c8", teal: "#207868",
    },
  };

  // ------------------------------------------------------------- scaling
  function fit() {
    const availW = window.innerWidth - 24, availH = window.innerHeight - 70;
    let s = Math.floor(Math.min(availW / W, availH / H));
    if (s < 1) s = 1;
    G.scale = s;
    canvas.style.width = (W * s) + "px";
    canvas.style.height = (H * s) + "px";
    const info = document.getElementById("scaleinfo");
    if (info) info.textContent = "  ·  " + s + "x";
  }
  window.addEventListener("resize", fit);
  fit();

  // ------------------------------------------------------------- primitives
  G.clear = function (color) { ctx.fillStyle = color || "#000"; ctx.fillRect(0, 0, W, H); };
  G.fill = function (x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  G.rect = function (x, y, w, h, color) { // 1px outline
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  };
  G.px = function (x, y, color) { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); };
  G.img = function (img, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (!img) return;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw === undefined ? sw : dw, dh === undefined ? sh : dh);
  };
  G.imgFull = function (img, dx, dy) { if (img) ctx.drawImage(img, dx || 0, dy || 0); };

  // ------------------------------------------------------------- font
  let fontImg = null, charmap = "";
  const tintCache = {};
  G.setFont = function (img, map) { fontImg = img; charmap = map; };
  function tinted(color) {
    if (color === "#f8f8f8" || color === "white") return fontImg;
    let c = tintCache[color];
    if (c) return c;
    const off = document.createElement("canvas");
    off.width = fontImg.width; off.height = fontImg.height;
    const o = off.getContext("2d");
    o.drawImage(fontImg, 0, 0);
    o.globalCompositeOperation = "source-in";
    o.fillStyle = color; o.fillRect(0, 0, off.width, off.height);
    tintCache[color] = off;
    return off;
  }
  const GLYPH_ALIAS = { "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "α": "\x04", "★": "\x8f", "☆": "*", "→": ">", "·": "\x03", "…": "\x8e" };
  G.text = function (x, y, str, color) {
    if (!fontImg || str == null) return;
    const img = tinted(color || "#000000");
    str = String(str);
    let cx = x;
    for (let i = 0; i < str.length; i++) {
      let ch = str[i];
      if (ch === "\n") { cx = x; y += 8; continue; }
      if (GLYPH_ALIAS[ch]) ch = GLYPH_ALIAS[ch];
      let idx = charmap.indexOf(ch);
      if (idx < 0) idx = ch === " " ? 0 : charmap.indexOf("?");
      if (idx > 0) ctx.drawImage(img, (idx % 16) * 8, Math.floor(idx / 16) * 8, 8, 8, cx, y, 8, 8);
      cx += 8;
    }
    return cx;
  };
  G.textC = function (cx, y, str, color) { G.text(Math.round(cx - String(str).length * 4), y, str, color); };
  G.textR = function (rx, y, str, color) { G.text(rx - String(str).length * 8, y, str, color); };
  // word-wrap into lines of at most n characters
  G.wrap = function (str, n) {
    const out = [];
    for (const para of String(str).split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        if (word.length > n) { if (line) out.push(line); out.push(word.slice(0, n)); line = word.slice(n); continue; }
        if ((line + (line ? " " : "") + word).length > n) { out.push(line); line = word; }
        else line = line ? line + " " + word : word;
      }
      out.push(line);
    }
    return out;
  };

  // ------------------------------------------------------------- panels
  // 'duel' : light blue fill, black outer line, brown inner line (the in-duel boxes)
  // 'talk' : black fill with a double blue border (message boxes on portrait screens)
  // 'card' : pale yellow fill with black border (card details / rewards)
  // 'menu' : dark navy fill with light border (generic menus)
  // 'list' : white-ish fill with black border
  G.box = function (x, y, w, h, style) {
    style = style || "duel";
    if (style === "duel") {
      G.fill(x, y, w, h, G.C.black);
      G.fill(x + 1, y + 1, w - 2, h - 2, G.C.border);
      G.fill(x + 2, y + 2, w - 4, h - 4, G.C.panel);
      // rounded corners
      G.px(x, y, G.C.panel); G.px(x + w - 1, y, G.C.panel); G.px(x, y + h - 1, G.C.panel); G.px(x + w - 1, y + h - 1, G.C.panel);
    } else if (style === "talk") {
      G.fill(x, y, w, h, G.C.blueLight);
      G.fill(x + 1, y + 1, w - 2, h - 2, G.C.navy);
      G.rect(x + 2, y + 2, w - 4, h - 4, G.C.blue);
      G.fill(x + 3, y + 3, w - 6, h - 6, "#000818");
    } else if (style === "card") {
      G.fill(x, y, w, h, G.C.black);
      G.fill(x + 1, y + 1, w - 2, h - 2, G.C.yellow);
    } else if (style === "menu") {
      G.fill(x, y, w, h, G.C.blueLight);
      G.fill(x + 1, y + 1, w - 2, h - 2, G.C.black);
      G.fill(x + 2, y + 2, w - 4, h - 4, "#102060");
    } else if (style === "list") {
      G.fill(x, y, w, h, G.C.black);
      G.fill(x + 1, y + 1, w - 2, h - 2, G.C.white);
    } else if (style === "dark") {
      G.fill(x, y, w, h, G.C.white);
      G.fill(x + 1, y + 1, w - 2, h - 2, G.C.black);
    }
  };
  // dim the whole screen (for overlays)
  G.dim = function (alpha) {
    ctx.fillStyle = "rgba(0,0,0," + (alpha === undefined ? 0.5 : alpha) + ")";
    ctx.fillRect(0, 0, W, H);
  };
  // small solid triangle pointing 'up' | 'down' | 'left' | 'right'
  G.tri = function (x, y, dir, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      if (dir === "down") ctx.fillRect(x + i, y + i, 7 - i * 2, 1);
      else if (dir === "up") ctx.fillRect(x + 3 - i, y + i, 1 + i * 2, 1);
      else if (dir === "right") ctx.fillRect(x + i, y + i, 1, 7 - i * 2);
      else ctx.fillRect(x + i, y + 3 - i, 1, 1 + i * 2); // left: the tip is the leftmost column
    }
  };
  // blinking helper
  G.blink = function (period) { return Math.floor(G.frame / (period || 16)) % 2 === 0; };

  // ------------------------------------------------------------- transitions
  G.fadeLevel = 0; // 0 = clear, 1 = black
  G.applyFade = function () {
    if (G.fadeLevel > 0) { ctx.fillStyle = "rgba(0,0,0," + Math.min(1, G.fadeLevel) + ")"; ctx.fillRect(0, 0, W, H); }
  };

  window.G = G;
})();
