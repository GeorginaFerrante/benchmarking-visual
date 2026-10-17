// Núcleo de cálculo: normalización, patrones, frecuencia, recomendador y contraste.
// Lo usa el generador al construir el sitio (nada de esto corre durante la visita).

export const MIN_SAMPLE = 3;
/** Pesos configurables del recomendador. Heurística inicial pendiente de validación. */
export const WEIGHTS = { frequency: 0.45, objective: 0.3, clarity: 0.25 };

/* ——— Color ——— */
export function hexToRgb(hex) {
  let h = String(hex).replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}
export const isLight = (hex) => relativeLuminance(hex) > 0.4;
export const bestTextOn = (bg) => (contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, "#111111") ? "#FFFFFF" : "#111111");

/* ——— Medidas ——— */
const round = (n) => Math.round(n * 1000) / 1000;
const inRange = (v, [a, b]) => v >= a && v <= b;

export function normalize(c) {
  return {
    widthNorm: round(c.box.w / c.viewport.w),
    xCenterNorm: round((c.box.x + c.box.w / 2) / c.viewport.w),
    yNorm: round(c.box.y / c.viewport.h),
    heightPx: Math.round(c.box.h),
    background: isLight(c.styles.background) ? "claro" : "oscuro",
  };
}

export function matchesCriteria(c, k) {
  const n = normalize(c);
  if (k.region && c.region !== k.region) return false;
  if (k.widthNorm && !inRange(n.widthNorm, k.widthNorm)) return false;
  if (k.xCenterNorm && !inRange(n.xCenterNorm, k.xCenterNorm)) return false;
  if (k.heightPx && !inRange(n.heightPx, k.heightPx)) return false;
  if (k.background && n.background !== k.background) return false;
  if (k.hasIcon !== undefined && c.hasIcon !== k.hasIcon) return false;
  if (k.radiusPx && !inRange(c.styles.radius, k.radiusPx)) return false;
  if (k.fontPx && !inRange(c.styles.fontSize ?? 0, k.fontPx)) return false;
  if (k.yMaxPx !== undefined && c.box.y > k.yMaxPx) return false;
  return true;
}

/** Clave de captura: la página de inicio usa "desktop"/"mobile"; las demás, "desktop_ficha", etc. */
export const captureKey = (device, pg = "home") => (pg === "home" ? device : `${device}_${pg}`);
export const pageOf = (x) => x.page ?? "home";

/**
 * Frecuencia de un patrón. Denominador: sitios con captura válida en ese dispositivo.
 * Una captura fallida no cuenta como «componente ausente».
 */
export function computePattern(rule, sites, comps) {
  const key = captureKey(rule.device, pageOf(rule));
  // Válido = la captura salió bien Y se midió al menos una parte en esa página y dispositivo.
  const measured = new Set(comps.filter((c) => c.device === rule.device && pageOf(c) === pageOf(rule)).map((c) => c.siteId));
  const valid = sites.filter((s) => s.captures?.[key]?.status === "ok" && measured.has(s.id)).map((s) => s.id);
  const validSet = new Set(valid);
  const relevant = comps.filter((c) => c.type === rule.componentType && c.device === rule.device && pageOf(c) === pageOf(rule) && validSet.has(c.siteId));
  const withComp = [...new Set(relevant.map((c) => c.siteId))];
  const matching = withComp.filter((id) => relevant.some((c) => c.siteId === id && matchesCriteria(c, rule.criteria)));
  return {
    rule,
    validSites: valid,
    sitesWithComponent: withComp,
    matching,
    exceptions: withComp.filter((id) => !matching.includes(id)),
    absent: valid.filter((id) => !withComp.includes(id)),
    frequency: valid.length ? matching.length / valid.length : null,
  };
}

export function formatFrequency(p) {
  if (p.frequency === null) return "Sin capturas válidas todavía";
  return `${p.matching.length} de ${p.validSites.length} referentes (${Math.round(p.frequency * 100)} %)`;
}

/**
 * Puntuación de adecuación 0–100. NO es probabilidad de éxito ni de conversión.
 * Combina frecuencia observada, ajuste al objetivo declarado y claridad estimada.
 */
export function scorePattern(p, objective) {
  if (p.validSites.length < MIN_SAMPLE || p.frequency === null) {
    return { score: null, factors: [], warnings: [`Evidencia insuficiente: hacen falta al menos ${MIN_SAMPLE} referentes con captura válida.`] };
  }
  const objectiveFit = !objective ? 0.6 : p.rule.goodFor.includes(objective) ? 1 : 0.3;
  const factors = [
    { label: "Frecuencia entre referentes", weight: WEIGHTS.frequency, value: p.frequency, note: `${p.matching.length} de ${p.validSites.length} lo usan.` },
    { label: "Ajuste a tu objetivo", weight: WEIGHTS.objective, value: objectiveFit, note: !objective ? "Sin objetivo indicado." : objectiveFit === 1 ? "Suele usarse para este objetivo." : "Se usa menos para este objetivo." },
    { label: "Claridad visual estimada", weight: WEIGHTS.clarity, value: p.rule.clarity, note: "Estimación del equipo; no medida con usuarios." },
  ];
  const raw = factors.reduce((s, f) => s + f.weight * f.value, 0);
  const warnings = p.validSites.length < 5 ? ["Muestra chica: tomá la puntuación como orientativa."] : [];
  return { score: Math.round((raw * 100) / 5) * 5, factors, warnings };
}

/** Etiqueta de comparación internacional. */
export function compareLabel(p, all) {
  const enough = all.filter((x) => x.validSites.length >= MIN_SAMPLE);
  if (p.validSites.length < MIN_SAMPLE) return "Datos insuficientes";
  const high = (x) => (x.frequency ?? 0) >= 0.6;
  if (high(p) && enough.every(high)) return "Patrón compartido";
  if (high(p)) return "Patrón local";
  return "Poco frecuente aquí";
}

/* ——— Segmentos, nombres y direcciones ——— */
export const SEGMENTS = [
  { slug: "tienda-online", name: "Tienda online", hint: "Vendés productos por internet", icon: "cart", types: ["ecommerce", "marketplace"], pages: ["home", "categoria", "ficha", "carrito"] },
  { slug: "informativo", name: "Sitio informativo o de noticias", hint: "Publicás contenido para leer", icon: "news", types: ["medios"], pages: ["home"] },
  { slug: "institucional", name: "Institucional o de gobierno", hint: "Trámites, información oficial", icon: "building", types: ["institucional"], pages: ["home"] },
  { slug: "finanzas", name: "Banco o finanzas", hint: "Servicios financieros", icon: "bank", types: ["finanzas"], pages: ["home"] },
  { slug: "turismo", name: "Turismo y reservas", hint: "Viajes, vuelos, alojamiento", icon: "plane", types: ["turismo"], pages: ["home"] },
  { slug: "salud", name: "Salud", hint: "Clínicas, información médica", icon: "heart", types: ["salud"], pages: ["home"] },
  { slug: "servicios", name: "Servicios o empresa", hint: "Mostrás lo que hacés y recibís consultas", icon: "briefcase", types: ["servicios", "portfolio", "corporativa", "saas"], pages: ["home"] },
  { slug: "comunidad", name: "Educación, ONG o comunidad", hint: "Cursos, causas, grupos", icon: "people", types: ["educacion", "comunidad", "ong", "entretenimiento"], pages: ["home"] },
];
export const PAGES = { home: "Página de inicio", categoria: "Página de categoría", ficha: "Ficha de producto", carrito: "Carrito y checkout" };
export const segmentOf = (siteType) => SEGMENTS.find((s) => s.types.includes(siteType));

export const COMPONENTS = [
  { type: "top_bar", page: "home", slug: "barra-superior", name: "Barra superior", hint: "La franja fina de avisos arriba de todo" },
  { type: "header", page: "home", slug: "header", name: "Header", hint: "La franja de arriba" },
  { type: "logo", page: "home", slug: "logo", name: "Logo", hint: "Dónde va la marca" },
  { type: "search_bar", page: "home", slug: "buscador", name: "Buscador", hint: "La barra para buscar" },
  { type: "main_nav", page: "home", slug: "menu", name: "Menú", hint: "Las secciones" },
  { type: "hero", page: "home", slug: "banner", name: "Banner principal", hint: "La imagen grande" },
  { type: "primary_button", page: "home", slug: "boton", name: "Botón principal", hint: "La acción más importante" },
  { type: "footer", page: "home", slug: "pie", name: "Pie de página", hint: "El cierre del sitio" },
  { type: "gallery", page: "ficha", slug: "fotos", name: "Fotos del producto", hint: "La galería de imágenes" },
  { type: "price", page: "ficha", slug: "precio", name: "Precio", hint: "Cómo se muestra" },
  { type: "buy_button", page: "ficha", slug: "comprar", name: "Botón de compra", hint: "Agregar al carrito" },
  { type: "filters", page: "categoria", slug: "filtros", name: "Filtros", hint: "Cómo se filtra" },
  { type: "product_card", page: "categoria", slug: "tarjetas", name: "Tarjetas de producto", hint: "Cada producto del listado" },
  { type: "cart_summary", page: "carrito", slug: "resumen", name: "Resumen de compra", hint: "El total y el detalle del pedido" },
  { type: "checkout_button", page: "carrito", slug: "finalizar", name: "Botón de finalizar compra", hint: "El paso al pago" },
];
export const componentByType = (t) => COMPONENTS.find((c) => c.type === t);
export const flagEmoji = (code) => code.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));

export function slugify(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ——— Lo que comparten / lo que no ——— */
export const SHARED_MIN = 0.7; // «7 de cada 10» o más: coincidencia clara

/** Agrupa las alternativas de un componente y decide si los líderes coinciden. */
export function componentVerdict(rules, sites, comps, type, device, pg = "home") {
  const alts = rules.filter((r) => r.componentType === type && r.device === device && pageOf(r) === pg).map((r) => computePattern(r, sites, comps));
  if (!alts.length) return null;
  const valid = alts[0].validSites.length;
  const sorted = [...alts].sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0));
  const best = sorted[0];
  if (valid < MIN_SAMPLE || best.frequency === null || !best.sitesWithComponent.length && !best.matching.length) return { type, device, page: pg, alts: sorted, status: "sin-datos", valid };
  const status = best.frequency >= SHARED_MIN ? "comparten" : "no-comparten";
  return { type, device, page: pg, alts: sorted, best, status, valid };
}

/** Rango de medidas de los sitios que coinciden: demuestra que son parecidos. */
export function similarity(p, comps) {
  const cs = p.matching.map((id) => comps.find((c) => c.siteId === id && c.type === p.rule.componentType && c.device === p.rule.device && pageOf(c) === pageOf(p.rule))).filter(Boolean);
  if (!cs.length) return null;
  const ns = cs.map(normalize);
  const range = (arr) => [Math.min(...arr), Math.max(...arr)];
  return {
    comps: cs,
    width: range(ns.map((n) => Math.round(n.widthNorm * 100))),
    height: range(ns.map((n) => n.heightPx)),
    radius: range(cs.map((c) => c.styles.radius)),
    center: range(ns.map((n) => Math.round(n.xCenterNorm * 100))),
    light: ns.filter((n) => n.background === "claro").length,
  };
}

/** Agrupa países con patrones parecidos (distancia media entre frecuencias). */
export function groupCountries(vectors, threshold = 0.22) {
  const codes = Object.keys(vectors);
  const dist = (a, b) => { const ks = Object.keys(vectors[a]).filter((k) => k in vectors[b]); return ks.length ? ks.reduce((s, k) => s + Math.abs(vectors[a][k] - vectors[b][k]), 0) / ks.length : 1; };
  const groups = [];
  for (const c of codes) {
    const g = groups.find((gr) => gr.every((m) => dist(m, c) <= threshold));
    if (g) g.push(c); else groups.push([c]);
  }
  return groups;
}

/* ——— Textos automáticos a partir de las medidas ———
   Describe qué tienen en común los sitios: solo se afirma algo si lo cumple el 70 % o más. */
const pctOk = (n, total) => total && n / total >= SHARED_MIN;
const fmtRange = ([a, b], unit) => (a === b ? `${a}${unit}` : `entre ${a}${unit} y ${b}${unit}`);
export function describeCommon(comps, totalValid) {
  const n = comps.length;
  const shared = [], varies = [];
  if (!n) return { shared, varies, present: 0 };
  const ns = comps.map(normalize);
  const count = (f) => ns.filter(f).length;
  // presencia
  if (totalValid && n < totalValid) varies.push(`${totalValid - n} de ${totalValid} no lo tienen`);
  // posición horizontal
  const left = count((x) => x.xCenterNorm < 0.35), center = count((x) => x.xCenterNorm >= 0.35 && x.xCenterNorm <= 0.65), right = count((x) => x.xCenterNorm > 0.65);
  const pos = [[left, "a la izquierda"], [center, "centrado"], [right, "a la derecha"]].sort((a, b) => b[0] - a[0])[0];
  if (pctOk(pos[0], n) && ns.some((x) => x.widthNorm < 0.9)) shared.push(`está ${pos[1]} (${pos[0]} de ${n})`);
  else if (ns.some((x) => x.widthNorm < 0.9)) varies.push("la posición cambia de un sitio a otro");
  // arriba de todo
  const top = comps.filter((c) => c.box.y < 160).length;
  if (pctOk(top, n) && comps[0].type !== "footer") shared.push(`va arriba de todo, sin tener que bajar (${top} de ${n})`);
  // ancho
  const widths = ns.map((x) => Math.round(x.widthNorm * 100)).sort((a, b) => a - b);
  const spread = widths[widths.length - 1] - widths[0];
  if (widths[0] >= 95) shared.push("ocupa todo el ancho de la pantalla");
  else if (spread <= 25) shared.push(`ocupa ${fmtRange([widths[0], widths[widths.length - 1]], " %")} del ancho`);
  else varies.push(`el ancho va del ${widths[0]} % al ${widths[widths.length - 1]} %`);
  // fondo
  const light = count((x) => x.background === "claro");
  if (pctOk(light, n)) shared.push(`fondo claro (${light} de ${n})`);
  else if (pctOk(n - light, n)) shared.push(`fondo oscuro o de color (${n - light} de ${n})`);
  else varies.push("algunos usan fondo claro y otros oscuro o de color");
  // bordes
  const pill = comps.filter((c) => c.styles.radius >= 16).length, soft = comps.filter((c) => c.styles.radius > 0 && c.styles.radius < 16).length, square = n - pill - soft;
  const r = [[pill, "bordes muy redondeados"], [soft, "bordes apenas redondeados"], [square, "esquinas rectas"]].sort((a, b) => b[0] - a[0])[0];
  if (pctOk(r[0], n)) shared.push(`${r[1]} (${r[0]} de ${n})`);
  else varies.push("el redondeo de los bordes varía");
  // tamaño de letra (precio, botones)
  if (["price", "buy_button", "primary_button"].includes(comps[0].type)) {
    const fs = comps.map((c) => c.styles.fontSize ?? 0).filter(Boolean).sort((a, b) => a - b);
    if (fs.length && fs[fs.length - 1] - fs[0] <= 8) shared.push(`letra de ${fmtRange([fs[0], fs[fs.length - 1]], " px")}`);
    else if (fs.length) varies.push(`la letra va de ${fs[0]} a ${fs[fs.length - 1]} px`);
  }
  if (comps[0].type === "search_bar") {
    const icon = comps.filter((c) => c.hasIcon).length;
    if (pctOk(icon, n)) shared.push(`con ícono de lupa (${icon} de ${n})`);
  }
  return { shared, varies, present: n };
}
export const sentence = (parts) => (parts.length ? parts.join(", ").replace(/^./, (m) => m.toUpperCase()) + "." : "");

/* ——— Cómo compite una tienda ——— */
export const POSITIONS = [
  { slug: "precio", name: "Buen precio", hint: "Ofertas, descuentos, lo más barato", icon: "tag" },
  { slug: "calidad", name: "Calidad o marca", hint: "Productos elegidos, buena experiencia", icon: "star" },
  { slug: "lujo", name: "Lujo y exclusividad", hint: "Marcas premium, precios altos", icon: "gem" },
];


/* ═══ Lenguaje simple a partir de las medidas ═══ */
export function hsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}
/** Nombre de color en español, para que se entienda sin saber de diseño. */
export function colorName(hex) {
  const { h, s, l } = hsl(hex);
  if (l > 0.93) return "blanco";
  if (l < 0.13 || (l < 0.2 && s < 0.3)) return "negro";
  if (s < 0.15) return l > 0.6 ? "gris claro" : "gris oscuro";
  const n = h < 15 || h >= 345 ? "rojo" : h < 40 ? "naranja" : h < 65 ? "amarillo" : h < 160 ? "verde" : h < 200 ? "celeste" : h < 255 ? "azul" : h < 290 ? "violeta" : "rosa";
  return n + (l > 0.75 ? " claro" : l < 0.3 ? " oscuro" : "");
}
export const isSaturated = (hex) => { const { s, l } = hsl(hex); return s >= 0.55 && l > 0.2 && l < 0.85; };
const majority = (arr) => {
  const c = {};
  arr.forEach((x) => { c[x] = (c[x] || 0) + 1; });
  const [k, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  return { value: k, n };
};
const NEIGHBOR_NAMES = { top_bar: "la barra superior", header: "el header", logo: "el logo", search_bar: "el buscador", main_nav: "el menú", hero: "el banner", primary_button: "el botón principal", footer: "el pie", gallery: "las fotos", price: "el precio", buy_button: "el botón de compra", filters: "los filtros", product_card: "las tarjetas", cart_summary: "el resumen", checkout_button: "el botón de finalizar" };

/** El componente más cercano en la misma página del mismo sitio (para «cerca de…»). */
export function nearestOf(c, all) {
  const same = all.filter((o) => o.siteId === c.siteId && o.device === c.device && (o.page ?? "home") === (c.page ?? "home") && o.type !== c.type && !["header", "footer"].includes(o.type));
  const dist = (a, b) => {
    const dx = Math.max(0, Math.max(a.box.x - (b.box.x + b.box.w), b.box.x - (a.box.x + a.box.w)));
    const dy = Math.max(0, Math.max(a.box.y - (b.box.y + b.box.h), b.box.y - (a.box.y + a.box.h)));
    return Math.hypot(dx, dy);
  };
  // si uno contiene al otro no cuenta como «cerca»
  const cand = same.filter((o) => !(o.box.x <= c.box.x && o.box.y <= c.box.y && o.box.x + o.box.w >= c.box.x + c.box.w && o.box.y + o.box.h >= c.box.y + c.box.h));
  const best = cand.map((o) => ({ o, d: dist(c, o) })).sort((a, b) => a.d - b.d)[0];
  return best && best.d < 80 ? best.o.type : null;
}

/**
 * Describe en palabras simples qué tienen en común y qué cambia.
 * Devuelve filas { aspecto, texto, comun, n, total }: el texto va sin números
 * (los números se muestran en el gráfico). «En común» = lo cumple el 70 % o más.
 */
export function describePlain(comps, allComps = comps) {
  const total = comps.length;
  if (!total) return [];
  const rows = [];
  const row = (aspecto, texto, n, etiqueta) => rows.push({ aspecto, texto, n, total, comun: n / total >= SHARED_MIN, etiqueta: etiqueta ?? texto });
  const ns = comps.map(normalize);
  const median = (arr) => [...arr].sort((x, y) => x - y)[Math.floor(arr.length / 2)];
  const countBy = (vals) => majority(vals);
  // Posición
  const side = countBy(ns.map((x) => (x.widthNorm >= 0.9 ? "ocupa todo el ancho" : x.xCenterNorm < 0.35 ? "a la izquierda" : x.xCenterNorm > 0.65 ? "a la derecha" : "al centro")));
  const vert = countBy(comps.map((c) => (c.box.y < 160 ? "arriba de todo" : c.box.y < c.viewport.h ? "a la vista sin bajar" : "más abajo, hay que bajar")));
  if (side.n / total >= SHARED_MIN) row("Posición", `${side.value}, ${vert.value}`, Math.min(side.n, vert.n), side.value);
  else row("Posición", "cada uno lo ubica en un lugar distinto", side.n, side.value);
  // Tamaño (cuántos están cerca del ancho más común)
  const ws = ns.map((x) => Math.round(x.widthNorm * 100)), hs = comps.map((c) => Math.round(c.box.h));
  const mw = median(ws), mh = median(hs);
  const nearW = ws.filter((w) => Math.abs(w - mw) <= 10).length;
  const wTxt = mw >= 90 ? "todo el ancho" : `cerca de ${mw} % del ancho de la pantalla`;
  row("Tamaño", nearW / total >= SHARED_MIN ? `${wTxt}, unos ${mh} px de alto` : `muy distinto: entre ${Math.min(...ws)} % y ${Math.max(...ws)} % del ancho`, nearW, wTxt);
  // Color
  const cn = countBy(comps.map((c) => colorName(c.styles.background)));
  const tone = countBy(comps.map((c) => (isLight(c.styles.background) ? "claro" : "oscuro o de color")));
  const sat = comps.filter((c) => isSaturated(c.styles.background)).length;
  const satTxt = sat / total >= SHARED_MIN ? ", color fuerte (saturado)" : (total - sat) / total >= SHARED_MIN ? ", color suave (no saturado)" : "";
  if (cn.n / total >= SHARED_MIN) row("Color", `fondo ${cn.value}${satTxt}`, cn.n, `fondo ${cn.value}`);
  else if (tone.n / total >= SHARED_MIN) row("Color", `fondo ${tone.value}${satTxt}`, tone.n, `fondo ${tone.value}`);
  else row("Color", "algunos usan fondo claro y otros oscuro o de color", tone.n, `fondo ${tone.value}`);
  // Forma
  const shape = countBy(comps.map((c) => (c.styles.radius >= Math.min(16, c.box.h / 2 - 1) ? "redondeada, tipo píldora" : c.styles.radius > 0 ? "esquinas apenas redondeadas" : "esquinas rectas")));
  row("Forma", shape.n / total >= SHARED_MIN ? shape.value : "algunos redondeados y otros rectos", shape.n, shape.value);
  // Borde
  const bordered = comps.filter((c) => (c.styles.borderWidth ?? 0) > 0);
  if (bordered.length >= total - bordered.length) row("Borde", `con borde ${countBy(bordered.map((c) => colorName(c.styles.borderColor ?? "#999999"))).value}`, bordered.length, "con borde");
  else row("Borde", "sin borde", total - bordered.length);
  // Letra
  const fsz = comps.map((c) => c.styles.fontSize).filter(Boolean);
  if (fsz.length) {
    const mf = median(fsz), nearF = fsz.filter((f) => Math.abs(f - mf) <= 3).length;
    row("Letra", nearF / total >= SHARED_MIN ? `unos ${mf} px${mf >= 24 ? ", grande" : mf <= 14 ? ", chica" : ""}` : `muy distinta: de ${Math.min(...fsz)} a ${Math.max(...fsz)} px`, nearF, `letra de unos ${mf} px`);
  }
  // Cerca de
  const near = comps.map((c) => nearestOf(c, allComps)).filter(Boolean);
  if (near.length) { const m = countBy(near); if (m.n / total >= 0.5) row("Cerca de", NEIGHBOR_NAMES[m.value] ?? m.value, m.n, `cerca de ${NEIGHBOR_NAMES[m.value] ?? m.value}`); }
  // Qué se destaca
  const t0 = comps[0].type;
  if (["primary_button", "buy_button", "checkout_button"].includes(t0)) {
    const strong = comps.filter((c) => isSaturated(c.styles.background) || contrastRatio(c.styles.background, "#FFFFFF") >= 4.5).length;
    row("Qué se destaca", strong / total >= SHARED_MIN ? "es lo más llamativo de la pantalla: color fuerte y mucho contraste" : "algunos lo destacan con color fuerte y otros no", strong, "color fuerte y mucho contraste");
  } else if (["search_bar", "hero", "gallery"].includes(t0)) {
    const big = ns.filter((x) => x.widthNorm >= 0.4).length;
    row("Qué se destaca", big / total >= SHARED_MIN ? "se le da mucho espacio: es protagonista" : "algunos le dan mucho espacio y otros poco", big, "mucho espacio");
  } else if (t0 === "price") {
    const big = comps.filter((c) => (c.styles.fontSize ?? 0) >= 24).length;
    row("Qué se destaca", big / total >= SHARED_MIN ? "el precio es de lo más grande de la página" : "algunos lo muestran grande y otros no", big, "precio grande");
  }
  return rows;
}

/** Orden en que los sitios arman la página (de arriba hacia abajo). */
export const STRUCTURE_TYPES = { home: ["top_bar", "header", "main_nav", "hero", "primary_button", "footer"], categoria: ["header", "filters", "product_card", "footer"], ficha: ["header", "gallery", "price", "buy_button", "footer"], carrito: ["header", "cart_summary", "checkout_button", "footer"] };
export function structureOrder(sites, comps, pg = "home", device = "desktop") {
  const types = STRUCTURE_TYPES[pg] ?? [];
  const per = sites.map((s) => comps.filter((c) => c.siteId === s.id && c.device === device && (c.page ?? "home") === pg && types.includes(c.type))).filter((l) => l.length);
  if (!per.length) return null;
  const stats = types.map((t) => {
    const ranks = per.map((l) => { const sorted = [...l].sort((a, b) => a.box.y - b.box.y); const i = sorted.findIndex((c) => c.type === t); return i < 0 ? null : i / Math.max(1, sorted.length - 1); }).filter((x) => x !== null).sort((a, b) => a - b);
    return { type: t, present: ranks.length, total: per.length, median: ranks.length ? ranks[Math.floor(ranks.length / 2)] : 2 };
  }).filter((x) => x.present).sort((a, b) => a.median - b.median);
  return { total: per.length, stats };
}
