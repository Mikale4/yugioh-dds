// Loads every image/JSON asset, then hands control to the game.
(function () {
  const A = { img: {}, json: {}, ready: false };
  const IMAGES = ["cards", "portraits", "scenes", "backgrounds", "font", "icons_font", "title", "intro", "faces"];
  const JSONS = ["portraits", "scenes", "map_slots", "font"];

  function loadImage(name) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => { A.img[name] = im; res(); };
      im.onerror = () => { console.warn("missing image", name); res(); };
      im.src = "assets/" + name + ".png" + (window.ASSET_V || ""); // the same cache-buster index.html puts on the scripts
    });
  }
  // JSON via <script>-less fetch; falls back to embedded defaults when running from file://
  const DEFAULTS = {
    font: { charmap: " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz,.':!#*\x01\x02\x03&=\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x7f\x80\x81\x82\x83\x84\x85\x86\x87\x88\"\x89-!?\x8a\x8b>\x8c\x8d()~\x8e\x8f" },
    portraits: { pandora: 0, kaiba: 1, esproba: 2, ishizu: 3, joey: 4, mai: 5, mako: 6, marik: 7, darknite: 8, nitemare: 9, pseto: 10, paradox: 11, rex: 12, grandpa: 13, shadi: 14, slysheen: 15, tea: 16, tristan: 17, weevil: 18, seeker: 19, yamibakura: 20, yamiyugi: 21, yugi: 22,
      keith: 23, pegasus: 24, mokuba: 25, bakura: 26, panik: 27, solomon: 28, para: 29, dox: 30, shopkeep: 31, puppeteer: 32, heishin: 33, priestess: 34 },
    scenes: { yugi: 0, tristan: 1, mai: 2, mako: 3, joey: 4, kaiba: 5, yamibakura: 6 },
    map_slots: { "9": [[35, 19, 34, 34], [91, 19, 34, 34], [11, 67, 34, 34], [115, 67, 34, 34], [63, 99, 34, 34]], "10": [[27, 11, 34, 34], [75, 19, 34, 34], [122, 35, 35, 34], [3, 75, 34, 34], [51, 91, 34, 34], [99, 99, 34, 34]], "11": [[35, 19, 34, 34], [91, 19, 34, 34], [19, 83, 34, 34], [107, 83, 34, 34]] },
  };
  function loadJSON(name) {
    return fetch("assets/" + name + ".json" + (window.ASSET_V || "")).then((r) => r.json()).then((j) => { A.json[name] = j; }).catch(() => { A.json[name] = DEFAULTS[name]; });
  }
  A.load = function () {
    return Promise.all([...IMAGES.map(loadImage), ...JSONS.map(loadJSON)]).then(() => {
      for (const k of JSONS) if (!A.json[k]) A.json[k] = DEFAULTS[k];
      G.setFont(A.img.font, A.json.font.charmap);
      A.ready = true;
    });
  };
  // helpers
  A.drawCard = function (id, x, y) { // 64x80 card face
    const im = A.img.cards; if (!im) return;
    const i = id - 1;
    G.img(im, (i % 20) * 64, Math.floor(i / 20) * 80, 64, 80, x, y);
  };
  A.drawCardScaled = function (id, x, y, w, h) {
    const im = A.img.cards; if (!im) return;
    const i = id - 1;
    G.img(im, (i % 20) * 64, Math.floor(i / 20) * 80, 64, 80, x, y, w, h);
  };
  A.drawPortrait = function (key, x, y) {
    const idx = A.json.portraits[key]; if (idx === undefined || !A.img.portraits) return false;
    G.img(A.img.portraits, 0, idx * 88, 160, 88, x, y);
    return true;
  };
  A.drawFace = function (key, x, y) { // 32x32 face icon
    const idx = A.json.portraits[key]; if (idx === undefined || !A.img.faces) return false;
    G.img(A.img.faces, 0, idx * 32, 32, 32, x, y);
    return true;
  };
  A.hasScene = function (key) { return A.json.scenes && A.json.scenes[key] !== undefined && !!A.img.scenes; };
  A.drawScene = function (key, x, y) {
    const idx = A.json.scenes[key];
    G.img(A.img.scenes, 0, idx * 88, 160, 88, x, y);
  };
  A.drawBG = function (idx, x, y) { if (A.img.backgrounds) G.img(A.img.backgrounds, 0, idx * 144, 160, 144, x || 0, y || 0); };
  A.drawBGPart = function (idx, sx, sy, w, h, x, y) { if (A.img.backgrounds) G.img(A.img.backgrounds, sx, idx * 144 + sy, w, h, x, y); };
  // small icons from the font sheet: LP (16x8 at 0), ATK sword (8x8 at 16), DEF shield (8x8 at 24)
  A.icon = function (name, x, y, color) {
    const im = A.img.icons_font; if (!im) return;
    if (name === "lp") { G.text(x, y, "LP", color && color !== "black" ? color : "#000000"); return; }
    const map = { atk: [16, 8], def: [26, 8] };
    const m = map[name]; if (!m) return;
    if (!color || color === "black") { // tint black
      if (!A._iconBlack) {
        const off = document.createElement("canvas"); off.width = im.width; off.height = im.height;
        const o = off.getContext("2d"); o.drawImage(im, 0, 0); o.globalCompositeOperation = "source-in"; o.fillStyle = "#000"; o.fillRect(0, 0, off.width, off.height);
        A._iconBlack = off;
      }
      G.img(A._iconBlack, m[0], 0, m[1], 8, x, y);
    } else G.img(im, m[0], 0, m[1], 8, x, y);
  };
  window.Assets = A;
})();
