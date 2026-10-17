// Genera datos de EJEMPLO con sitios ficticios. Nunca se mezclan con los datos reales:
// el sitio los publica aparte, en /demo, con una etiqueta visible y sin indexar.
import fs from "node:fs";
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (a, b) => a + rnd() * (b - a);
const chance = (p) => rnd() < p;
// Tendencias ficticias por país para que el ejemplo muestre coincidencias y diferencias
const countries = {
  AR: { searchW: [0.4, 0.6], dark: 0.2, pill: 0.3, center: 0.1, navH: 0.8, side: 0.8, big: 0.9, galL: 0.9, fullBuy: 0.8, heroFull: 0.5, footDark: 0.6 },
  MX: { searchW: [0.4, 0.62], dark: 0.25, pill: 0.35, center: 0.1, navH: 0.7, side: 0.8, big: 0.85, galL: 0.9, fullBuy: 0.8, heroFull: 0.6, footDark: 0.6 },
  US: { searchW: [0.3, 0.55], dark: 0.4, pill: 0.8, center: 0.2, navH: 0.5, side: 0.6, big: 0.4, galL: 0.8, fullBuy: 0.9, heroFull: 0.8, footDark: 0.4 },
  DE: { searchW: [0.3, 0.5], dark: 0.4, pill: 0.7, center: 0.2, navH: 0.5, side: 0.6, big: 0.4, galL: 0.8, fullBuy: 0.9, heroFull: 0.8, footDark: 0.4 },
  CN: { searchW: [0.35, 0.5], dark: 0.1, pill: 0.9, center: 0.05, navH: 0.9, side: 0.3, big: 0.95, galL: 0.95, fullBuy: 0.3, heroFull: 0.3, footDark: 0.2 },
  JP: { searchW: [0.3, 0.45], dark: 0.1, pill: 0.6, center: 0.05, navH: 0.9, side: 0.9, big: 0.9, galL: 0.9, fullBuy: 0.4, heroFull: 0.3, footDark: 0.3 },
};
const VP = { desktop: { w: 1440, h: 900 }, mobile: { w: 390, h: 844 } };
const letters = "ABCDEF";
const refs = [], comps = [];
for (const [cc, p] of Object.entries(countries)) {
  for (let i = 0; i < 6; i++) {
    const id = `demo-${cc.toLowerCase()}-${i + 1}`;
    const caps = {};
    for (const d of ["desktop", "mobile"]) for (const pg of ["home", "ficha", "categoria", "carrito"]) {
      const key = pg === "home" ? d : `${d}_${pg}`;
      const failed = i === 5 && d === "mobile" && pg === "home";
      caps[key] = { status: failed ? "fallida" : "ok", date: "2026-10-16", screenshot: null, viewport: VP[d], ...(failed ? { error: "Bloqueo por CAPTCHA (simulado)" } : {}) };
    }
    refs.push({ id, name: `Tienda ficticia ${cc}-${letters[i]}`, url: "", country: cc, siteType: "ecommerce", sector: "general", objectives: ["vender"],
      reason: "Sitio ficticio creado para mostrar cómo funciona el sitio.", sources: [{ title: "Datos de ejemplo", kind: "pendiente" }], demo: true, captures: caps });
    const dark = chance(p.dark);
    const headerBg = dark ? pick(["#1F2A6B", "#C8102E", "#0B3D2E", "#222222"]) : pick(["#FFFFFF", "#FFF159", "#F5F5F5", "#FFFFFF"]);
    const accent = pick(["#3483FA", "#E4002B", "#FF5000", "#00A650", "#7B2CBF", "#FF6A00"]);
    const pill = chance(p.pill);
    for (const device of ["desktop", "mobile"]) {
      const vp = VP[device], d = device === "desktop";
      const add = (page, type, region, box, styles, hasIcon = false) => {
        if (page === "home" && device === "mobile" && i === 5) return;
        comps.push({ id: `${id}-${device}-${page}-${type}`, siteId: id, page, device, type, region, box, viewport: vp, styles: { radius: 0, ...styles }, hasIcon, crop: null, method: "demo", confidence: "sin_verificar" });
      };
      const hH = d ? Math.round(between(64, 110)) : Math.round(between(56, 116));
      const tb = chance(p.topbar ?? 0.6) ? 34 : 0;
      if (tb) add("home", "top_bar", "header", { x: 0, y: 0, w: vp.w, h: tb }, { background: chance(0.7) ? pick(["#1E1E2A", "#0B3D2E", "#C8102E", accent]) : "#F2F2F2", color: "#FFFFFF", fontSize: 13 });
      add("home", "header", "header", { x: 0, y: tb, w: vp.w, h: hH }, { background: headerBg, color: dark ? "#FFFFFF" : "#1A1A1A" });
      const lw = d ? 140 : 96, center = chance(p.center);
      add("home", "logo", "header", { x: center ? (vp.w - lw) / 2 : d ? 32 : 56, y: 14, w: lw, h: 36 }, { background: headerBg, color: accent });
      if (!(cc === "AR" && i === 3)) {
        const sw = d ? between(...p.searchW) : chance(0.75) ? between(0.86, 0.95) : 0.11;
        add("home", "search_bar", "header", { x: d ? Math.round(between(180, 400)) : Math.round((vp.w - vp.w * sw) / 2), y: d ? 18 : hH - 50, w: Math.round(vp.w * sw), h: 40 }, { background: "#FFFFFF", color: "#333333", radius: pill ? 20 : pick([2, 4, 6]), fontSize: 14, borderWidth: chance(0.8) ? 1 : 0, borderColor: pick(["#CCCCCC", "#DDDDDD", accent]) }, true);
      }
      const navW = d ? (chance(p.navH) ? between(0.45, 0.8) : between(0.05, 0.2)) : chance(0.65) ? 0.12 : between(0.7, 1);
      add("home", "main_nav", "header", { x: 32, y: hH - 40, w: Math.round(vp.w * navW), h: 36 }, { background: headerBg, color: dark ? "#FFFFFF" : "#333333", fontSize: 14 });
      const heroW = chance(p.heroFull) ? 1 : between(0.7, 0.88);
      add("home", "hero", "body", { x: Math.round((vp.w - vp.w * heroW) / 2), y: hH + 16, w: Math.round(vp.w * heroW), h: d ? 360 : 200 }, { background: "#DDE6F5", radius: heroW < 1 ? 12 : 0 });
      add("home", "primary_button", "body", { x: 80, y: hH + 280, w: 180, h: 48 }, { background: accent, color: "#FFFFFF", radius: pill ? 24 : pick([0, 4, 6]), fontSize: 16 });
      add("home", "footer", "footer", { x: 0, y: 2400, w: vp.w, h: 320 }, { background: chance(p.footDark) ? "#1E1E2A" : "#F2F2F2", color: "#CCCCCC" });
      // ficha de producto
      const galW = d ? between(0.38, 0.5) : chance(0.7) ? 1 : between(0.88, 0.92) * 0.9;
      const galX = d ? (chance(p.galL) ? 40 : vp.w * between(0.5, 0.55)) : (vp.w - vp.w * galW) / 2;
      add("ficha", "gallery", "body", { x: Math.round(galX), y: hH + 24, w: Math.round(vp.w * galW), h: d ? 520 : 360 }, { background: "#FFFFFF", radius: pick([0, 8]) });
      add("ficha", "price", "body", { x: d ? 820 : 16, y: hH + (d ? 120 : 420), w: 220, h: 44 }, { background: "#FFFFFF", color: "#111111", fontSize: chance(p.big) ? (d ? Math.round(between(28, 40)) : Math.round(between(24, 30))) : Math.round(between(18, 22)) });
      const buyW = d ? 320 : chance(p.fullBuy) ? vp.w - 32 : vp.w * 0.5;
      add("ficha", "buy_button", "body", { x: d ? 820 : 16, y: hH + (d ? 260 : 520), w: Math.round(buyW), h: 52 }, { background: accent, color: "#FFFFFF", radius: pill ? 26 : pick([0, 4, 6]), fontSize: 18 });
      // categoría
      const side = chance(p.side);
      add("categoria", "filters", "body", d ? (side ? { x: 24, y: hH + 24, w: 250, h: 900 } : { x: 24, y: hH + 24, w: vp.w - 48, h: 56 }) : (chance(0.7) ? { x: 16, y: hH + 12, w: 120, h: 40 } : { x: 0, y: hH + 12, w: vp.w, h: 44 }), { background: "#FFFFFF", radius: 8 });
      // carrito
      add("carrito", "cart_summary", "body", d ? (chance(0.85) ? { x: 960, y: hH + 40, w: 420, h: 360 } : { x: 40, y: hH + 600, w: 900, h: 260 }) : { x: 0, y: hH + 520, w: vp.w, h: 300 }, { background: chance(0.7) ? "#F5F5F5" : "#FFFFFF", radius: pick([0, 8, 12]), borderWidth: chance(0.5) ? 1 : 0, borderColor: "#DDDDDD" });
      add("carrito", "checkout_button", "body", { x: d ? 980 : 16, y: hH + (d ? 330 : 760), w: d ? 380 : vp.w - 32, h: 52 }, { background: accent, color: "#FFFFFF", radius: pill ? 26 : pick([0, 4, 6]), fontSize: 18 });
      add("categoria", "product_card", "body", { x: d ? 300 : 16, y: hH + 120, w: d ? 260 : 170, h: d ? 380 : 300 }, { background: "#FFFFFF", radius: pill ? pick([12, 16]) : pick([0, 2, 4]) });
    }
  }
}
fs.writeFileSync(new URL("../../datos/demo-references.json", import.meta.url), JSON.stringify(refs, null, 2));
fs.writeFileSync(new URL("../../datos/demo-components.json", import.meta.url), JSON.stringify(comps, null, 2));
console.log(`Ejemplo: ${refs.length} sitios ficticios, ${comps.length} componentes`);
