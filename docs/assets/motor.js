/* DesignTrust · motor de resultados para el navegador (generado). */
(function(){
// Núcleo de cálculo: normalización, patrones, frecuencia, recomendador y contraste.
// Lo usa el generador al construir el sitio (nada de esto corre durante la visita).

const MIN_SAMPLE = 3;
/** Pesos configurables del recomendador. Heurística inicial pendiente de validación. */
const WEIGHTS = { frequency: 0.45, objective: 0.3, clarity: 0.25 };

/* ——— Color ——— */
function hexToRgb(hex) {
  let h = String(hex).replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(a, b) {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}
const isLight = (hex) => relativeLuminance(hex) > 0.4;
const bestTextOn = (bg) => (contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, "#111111") ? "#FFFFFF" : "#111111");

/* ——— Medidas ——— */
const round = (n) => Math.round(n * 1000) / 1000;
const inRange = (v, [a, b]) => v >= a && v <= b;

function normalize(c) {
  return {
    widthNorm: round(c.box.w / c.viewport.w),
    xCenterNorm: round((c.box.x + c.box.w / 2) / c.viewport.w),
    yNorm: round(c.box.y / c.viewport.h),
    heightPx: Math.round(c.box.h),
    background: isLight(c.styles.background) ? "claro" : "oscuro",
  };
}

function matchesCriteria(c, k) {
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
const captureKey = (device, pg = "home") => (pg === "home" ? device : `${device}_${pg}`);
const pageOf = (x) => x.page ?? "home";

/**
 * Frecuencia de un patrón. Denominador: sitios con captura válida en ese dispositivo.
 * Una captura fallida no cuenta como «componente ausente».
 */
function computePattern(rule, sites, comps) {
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
    // Frecuencia entre los que TIENEN esa parte: si a un sitio no se le detectó, no cuenta en contra.
    frequency: withComp.length ? matching.length / withComp.length : null,
  };
}

function formatFrequency(p) {
  if (p.frequency === null) return "Sin capturas válidas todavía";
  return `${p.matching.length} de ${p.sitesWithComponent.length} que lo tienen (${Math.round(p.frequency * 100)} %)`;
}

/**
 * Puntuación de adecuación 0–100. NO es probabilidad de éxito ni de conversión.
 * Combina frecuencia observada, ajuste al objetivo declarado y claridad estimada.
 */
function scorePattern(p, objective) {
  if (p.sitesWithComponent.length < MIN_SAMPLE || p.frequency === null) {
    return { score: null, factors: [], warnings: [`Evidencia insuficiente: hacen falta al menos ${MIN_SAMPLE} referentes con captura válida.`] };
  }
  const objectiveFit = !objective ? 0.6 : p.rule.goodFor.includes(objective) ? 1 : 0.3;
  const factors = [
    { label: "Frecuencia entre referentes", weight: WEIGHTS.frequency, value: p.frequency, note: `${p.matching.length} de ${p.sitesWithComponent.length} lo usan.` },
    { label: "Ajuste a tu objetivo", weight: WEIGHTS.objective, value: objectiveFit, note: !objective ? "Sin objetivo indicado." : objectiveFit === 1 ? "Suele usarse para este objetivo." : "Se usa menos para este objetivo." },
    { label: "Claridad visual estimada", weight: WEIGHTS.clarity, value: p.rule.clarity, note: "Estimación del equipo; no medida con usuarios." },
  ];
  const raw = factors.reduce((s, f) => s + f.weight * f.value, 0);
  const warnings = p.sitesWithComponent.length < 5 ? ["Muestra chica: tomá la puntuación como orientativa."] : [];
  return { score: Math.round((raw * 100) / 5) * 5, factors, warnings };
}

/** Etiqueta de comparación internacional. */
function compareLabel(p, all) {
  const enough = all.filter((x) => x.sitesWithComponent.length >= MIN_SAMPLE);
  if (p.sitesWithComponent.length < MIN_SAMPLE) return "Datos insuficientes";
  const high = (x) => (x.frequency ?? 0) >= 0.6;
  if (high(p) && enough.every(high)) return "Patrón compartido";
  if (high(p)) return "Patrón local";
  return "Poco frecuente aquí";
}

/* ——— Segmentos, nombres y direcciones ——— */
const SEGMENTS = [
  { slug: "tienda-online", name: "Tienda online", hint: "Vendés productos por internet", icon: "cart", types: ["ecommerce", "marketplace"], pages: ["home", "categoria", "ficha", "carrito"] },
  { slug: "informativo", name: "Sitio informativo o de noticias", hint: "Publicás contenido para leer", icon: "news", types: ["medios"], pages: ["home"] },
  { slug: "institucional", name: "Institucional o de gobierno", hint: "Trámites, información oficial", icon: "building", types: ["institucional"], pages: ["home"] },
  { slug: "finanzas", name: "Banco o finanzas", hint: "Servicios financieros", icon: "bank", types: ["finanzas"], pages: ["home"] },
  { slug: "turismo", name: "Turismo y reservas", hint: "Viajes, vuelos, alojamiento", icon: "plane", types: ["turismo"], pages: ["home"] },
  { slug: "salud", name: "Salud", hint: "Clínicas, información médica", icon: "heart", types: ["salud"], pages: ["home"] },
  { slug: "servicios", name: "Servicios o empresa", hint: "Mostrás lo que hacés y recibís consultas", icon: "briefcase", types: ["servicios", "portfolio", "corporativa", "saas"], pages: ["home"] },
  { slug: "comunidad", name: "Educación, ONG o comunidad", hint: "Cursos, causas, grupos", icon: "people", types: ["educacion", "comunidad", "ong", "entretenimiento"], pages: ["home"] },
];
const PAGES = { home: "Página de inicio", categoria: "Página de categoría", ficha: "Ficha de producto", carrito: "Carrito y checkout" };
const segmentOf = (siteType) => SEGMENTS.find((s) => s.types.includes(siteType));

const COMPONENTS = [
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
const componentByType = (t) => COMPONENTS.find((c) => c.type === t);
const flagEmoji = (code) => code.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));

function slugify(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ——— Lo que comparten / lo que no ——— */
const SHARED_MIN = 0.7; // «7 de cada 10» o más: coincidencia clara

/** Agrupa las alternativas de un componente y decide si los líderes coinciden. */
function componentVerdict(rules, sites, comps, type, device, pg = "home") {
  const alts = rules.filter((r) => r.componentType === type && r.device === device && pageOf(r) === pg).map((r) => computePattern(r, sites, comps));
  if (!alts.length) return null;
  const valid = alts[0].validSites.length;
  const sorted = [...alts].sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0));
  const best = sorted[0];
  if (valid < MIN_SAMPLE || best.frequency === null || best.sitesWithComponent.length < MIN_SAMPLE) return { type, device, page: pg, alts: sorted, status: "sin-datos", valid };
  const status = best.frequency >= SHARED_MIN ? "comparten" : "no-comparten";
  return { type, device, page: pg, alts: sorted, best, status, valid };
}

/** Rango de medidas de los sitios que coinciden: demuestra que son parecidos. */
function similarity(p, comps) {
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
function groupCountries(vectors, threshold = 0.22) {
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
function describeCommon(comps, totalValid) {
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
const sentence = (parts) => (parts.length ? parts.join(", ").replace(/^./, (m) => m.toUpperCase()) + "." : "");

/* ——— Cómo compite una tienda ——— */
const POSITIONS = [
  { slug: "precio", name: "Buen precio", hint: "Ofertas, descuentos, lo más barato", icon: "tag" },
  { slug: "calidad", name: "Calidad o marca", hint: "Productos elegidos, buena experiencia", icon: "star" },
  { slug: "lujo", name: "Lujo y exclusividad", hint: "Marcas premium, precios altos", icon: "gem" },
];


/* ═══ Lenguaje simple a partir de las medidas ═══ */
function hsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}
/** Nombre de color en español, para que se entienda sin saber de diseño. */
function colorName(hex) {
  const { h, s, l } = hsl(hex);
  if (l > 0.93) return "blanco";
  if (l < 0.13 || (l < 0.2 && s < 0.3)) return "negro";
  if (s < 0.15) return l > 0.6 ? "gris claro" : "gris oscuro";
  const n = h < 15 || h >= 345 ? "rojo" : h < 40 ? "naranja" : h < 65 ? "amarillo" : h < 160 ? "verde" : h < 200 ? "celeste" : h < 255 ? "azul" : h < 290 ? "violeta" : "rosa";
  return n + (l > 0.75 ? " claro" : l < 0.3 ? " oscuro" : "");
}
const isSaturated = (hex) => { const { s, l } = hsl(hex); return s >= 0.55 && l > 0.2 && l < 0.85; };
const majority = (arr) => {
  const c = {};
  arr.forEach((x) => { c[x] = (c[x] || 0) + 1; });
  const [k, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  return { value: k, n };
};
const NEIGHBOR_NAMES = { top_bar: "la barra superior", header: "el header", logo: "el logo", search_bar: "el buscador", main_nav: "el menú", hero: "el banner", primary_button: "el botón principal", footer: "el pie", gallery: "las fotos", price: "el precio", buy_button: "el botón de compra", filters: "los filtros", product_card: "las tarjetas", cart_summary: "el resumen", checkout_button: "el botón de finalizar" };

/** El componente más cercano en la misma página del mismo sitio (para «cerca de…»). */
function nearestOf(c, all) {
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
function describePlain(comps, allComps = comps) {
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
  // Tamaño en palabras: ancho y alto relativos a la pantalla
  const sizeTxt = countBy(comps.map((c) => `${widthWord(normalize(c).widthNorm)}, ${heightWord(c)}`));
  const shapeTxt = countBy(comps.map((c) => shapeWord(c)));
  if (sizeTxt.n / total >= SHARED_MIN) row("Tamaño", `${sizeTxt.value}: ${shapeTxt.n / total >= SHARED_MIN ? shapeTxt.value : "proporciones parecidas"}`, sizeTxt.n, sizeTxt.value);
  else row("Tamaño", "muy distinto de un sitio a otro", sizeTxt.n, sizeTxt.value);
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
  const fz = comps.map((c) => fontWord(c.styles.fontSize)).filter(Boolean);
  if (fz.length) { const m = countBy(fz); row("Letra", m.n / total >= SHARED_MIN ? m.value : "algunos con letra grande y otros chica", m.n, m.value); }
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
const STRUCTURE_TYPES = { home: ["top_bar", "header", "main_nav", "hero", "primary_button", "footer"], categoria: ["header", "filters", "product_card", "footer"], ficha: ["header", "gallery", "price", "buy_button", "footer"], carrito: ["header", "cart_summary", "checkout_button", "footer"] };
function structureOrder(sites, comps, pg = "home", device = "desktop") {
  const types = STRUCTURE_TYPES[pg] ?? [];
  const per = sites.map((s) => comps.filter((c) => c.siteId === s.id && c.device === device && (c.page ?? "home") === pg && types.includes(c.type))).filter((l) => l.length);
  if (!per.length) return null;
  const stats = types.map((t) => {
    const ranks = per.map((l) => { const sorted = [...l].sort((a, b) => a.box.y - b.box.y); const i = sorted.findIndex((c) => c.type === t); return i < 0 ? null : i / Math.max(1, sorted.length - 1); }).filter((x) => x !== null).sort((a, b) => a - b);
    return { type: t, present: ranks.length, total: per.length, median: ranks.length ? ranks[Math.floor(ranks.length / 2)] : 2 };
  }).filter((x) => x.present).sort((a, b) => a.median - b.median);
  return { total: per.length, stats };
}


/* ═══ Tamaño y forma en palabras (sin píxeles) ═══ */
function widthWord(wn) {
  return wn >= 0.9 ? "todo el ancho" : wn >= 0.6 ? "casi todo el ancho" : wn >= 0.35 ? "cerca de la mitad del ancho" : wn >= 0.15 ? "un tercio del ancho o menos" : "una parte chica del ancho";
}
function heightWord(c) {
  const hn = c.box.h / Math.max(1, c.viewport.h);
  return hn < 0.06 ? "muy bajo" : hn < 0.15 ? "bajo" : hn < 0.4 ? "de alto mediano" : hn < 0.9 ? "alto, ocupa buena parte de la pantalla" : "muy alto, más que la pantalla";
}
function shapeWord(c) {
  const a = c.box.w / Math.max(1, c.box.h);
  return a >= 8 ? "una franja larga y fina" : a >= 3 ? "rectangular y alargado" : a >= 1.25 ? "rectangular" : a >= 0.8 ? "casi cuadrado" : "más alto que ancho";
}
function cornerWord(c) {
  const r = c.styles.radius ?? 0;
  return r >= Math.min(16, c.box.h / 2 - 1) ? "redondeado, tipo píldora" : r > 0 ? "esquinas apenas redondeadas" : "esquinas rectas";
}
function fontWord(px) { return !px ? "" : px >= 24 ? "letra grande" : px >= 15 ? "letra mediana" : "letra chica"; }
/** Descripción corta de una sola parte, para las tarjetas. */
function describeOne(c) {
  const n = normalize(c);
  return [
    ["Tamaño", `${widthWord(n.widthNorm)}, ${heightWord(c)}`],
    ["Forma", `${shapeWord(c)}, ${cornerWord(c)}`],
    ["Color", `fondo ${colorName(c.styles.background)}${isSaturated(c.styles.background) ? ", color fuerte" : ""}`],
    ...(c.styles.borderWidth ? [["Borde", `con borde ${colorName(c.styles.borderColor ?? "#999999")}`]] : []),
    ...(c.styles.fontSize ? [["Letra", fontWord(c.styles.fontSize)]] : []),
    ["Posición", n.widthNorm >= 0.9 ? (c.box.y < 160 ? "arriba de todo, de borde a borde" : "de borde a borde") : `${n.xCenterNorm < 0.35 ? "a la izquierda" : n.xCenterNorm > 0.65 ? "a la derecha" : "al centro"}${c.box.y < 160 ? ", arriba de todo" : ""}`],
  ];
}

// Plantillas HTML del sitio. Todo se genera como texto estático.

const SITE_URL = "https://georginaferrante.github.io/benchmarking-visual/";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Enlace relativo que funciona con doble clic (file://) y en GitHub Pages. */
const link = (ctx, p = "") => `${ctx.rel}${p}${p === "" || p.endsWith("/") ? "index.html" : ""}`;

/* Paleta de gráficos (saturada, como las referencias) */
const CHART = ["#18B26B", "#3A6FF8", "#F08A1C", "#EC4F7C", "#8B5CF6", "#12A594", "#E5484D", "#FFC14D"];
/* Sistema de color con significado:
   verde  = acción principal y «lo que hace la mayoría»
   naranja = «varía, tenés libertad»
   gris   = sin datos / opciones minoritarias
   tinta  = selección activa en filtros y pestañas */
const MAJORITY = "#16A34A", MINORITY = "#94A3B8", NONE = "#D7DCE6";

/* ——— Íconos (trazo simple) ——— */
const P = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  split: '<path d="M12 3v7M12 10l-6 6M12 10l6 6M6 16v5M18 16v5"/>',
  cart: '<path d="M3 4h2l2.2 11h10.6L20 7H6.2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  building: '<path d="M4 21h16M6 21V9l6-5 6 5v12M10 21v-5h4v5"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  plane: '<path d="M3 13l18-7-5 15-4-6-9-2z"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>',
  people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 20c0-2 1.2-4.5 4-4.5s2.5 1.5 2.5 2"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-1.3-1-1.5-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7" r="1.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  gem: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 18M15 3l-3 18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
};
const icon = (name, color = "currentColor", w = 2.2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
const greenFlag = () =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 22V3" stroke="#0E7A48" stroke-width="2.4" stroke-linecap="round"/><path d="M5.5 3.5h12.5l-2.6 4.5 2.6 4.5H5.5z" fill="#18B26B"/></svg>`;

/** Botón principal (verde): siempre «avanzar / ver resultado». */
const pill = (href, text, { size = "", ico = "arrow", attrs = "" } = {}) =>
  `<a class="pill ${size}" href="${href}" ${attrs}><span>${text}</span><span class="ico">${icon(ico, "#fff")}</span></a>`;
/** Botón secundario (blanco con borde): siempre «volver, cambiar, ver más». */
const btn2 = (href, text, ico = "") => `<a class="btn2" href="${href}">${ico ? icon(ico) : ""}<span>${text}</span></a>`;

/* ——— Página ——— */
function page(ctx, { path, title, description, body, active = "", jsonLd, index = true }) {
  const canonical = `${SITE_URL}${ctx.prefix}${path}`;
  const full = path === "" && !ctx.demo ? title : `${title} · DesignTrust`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${ctx.demo || !index ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="es_AR">
<meta name="theme-color" content="#FFFFFF">
${ctx.headExtra ?? ""}
<meta property="og:site_name" content="DesignTrust">
<link rel="icon" href="${ctx.root}assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${ctx.root}assets/styles.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
</head>
<body>
<a class="skip" href="#contenido">Saltar al contenido</a>
${ctx.demo ? `<div class="demo-banner" role="status">Ejemplo con sitios ficticios, para que veas cómo se verá. <a href="${ctx.root}index.html">Volver al sitio real</a></div>` : ""}
<header class="topbar"><div class="topbar-inner">
<a href="${link(ctx)}" class="brand" aria-label="DesignTrust, inicio">${brandMark()}<span class="brand-text"><b>Design<span>Trust</span></b><small>Benchmarking de diseño web${ctx.demo ? " · ejemplo" : ""}</small></span></a>
<nav class="top-links" aria-label="Principal">
<a href="${link(ctx)}"${active === "home" ? ' aria-current="page"' : ""}>Nueva consulta</a>
<a class="hide-sm" href="${link(ctx, "explorar/")}"${active === "explorar" ? ' aria-current="page"' : ""}>Otras regiones</a>
</nav></div></header>
<main id="contenido">
${body}
</main>
<footer class="site-footer"><div>
<span>DesignTrust · benchmarking de diseño web, gratis y sin registro</span>
<a href="${link(ctx, "explorar/")}">Explorar regiones</a>
<a href="${link(ctx, "paleta/")}">Armar mi paleta</a>
<a href="${link(ctx, "como-funciona/")}">Cómo funciona</a>
<a href="${link(ctx, "cobertura/")}">Qué países tenemos</a>
<span>Datos: ${esc(ctx.meta.generatedAt)}</span>
</div></footer>
<script src="${ctx.root}assets/app.js"></script>
</body>
</html>`;
}

function brandMark() {
  return `<svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="dtg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E40AF"/><stop offset=".55" stop-color="#1C7EEA"/><stop offset="1" stop-color="#14C8B0"/></linearGradient></defs><path d="M6 4h17c11 0 19 8.5 19 20s-8 20-19 20H13L6 37z" fill="url(#dtg)"/><path d="M13 11v26l4 4h6c7.5 0 12.5-7 12.5-17S30.5 7 23 7H13z" fill="#fff" fill-opacity=".14"/><path d="M15 23l6 6 13-13" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const crumbs = (ctx, items) =>
  `<nav aria-label="Ruta" class="crumbs">${items.map(([href, label], i) => (i < items.length - 1 ? `<a href="${link(ctx, href)}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`)).join(" › ")}</nav>`;

/* ——— Gráficos ——— */
function donut(value, total, color = "#18B26B", label = "") {
  const r = 52, c = 2 * Math.PI * r, f = total ? value / total : 0;
  return `<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="${value} de ${total}${label ? " " + esc(label) : ""}">
<circle cx="70" cy="70" r="${r}" fill="none" stroke="#EEF1F8" stroke-width="18"/>
<circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 70 70)"/>
<text x="70" y="68" text-anchor="middle" font-size="34" font-weight="900" fill="#1B1F3B">${value}/${total}</text>
<text x="70" y="92" text-anchor="middle" font-size="14" font-weight="700" fill="#5A6080">${Math.round(f * 100)} %</text>
</svg>`;
}

function stackbar(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return `<div class="stackbar" role="img" aria-label="${parts.map((p) => `${esc(p.label)}: ${p.value}`).join(", ")}">${parts.filter((p) => p.value).map((p) => `<i style="width:${(p.value / total) * 100}%;background:${p.color}"></i>`).join("")}</div>
<ul class="legend">${parts.map((p) => `<li><span style="background:${p.color}"></span>${esc(p.label)} · ${p.value}</li>`).join("")}</ul>`;
}

/** Barras de opciones: la mayoritaria en verde, el resto en gris. */
function optionBars(rows, total) {
  const max = Math.max(...rows.map((r) => r.n));
  // El verde se mide entre los que tienen esta parte (igual que la recomendación).
  const base = Math.max(1, total - rows.filter((r) => r.none).reduce((s, r) => s + r.n, 0));
  return `<div class="obars" role="img" aria-label="${rows.map((r) => `${esc(r.label)}: ${r.n} de ${total}`).join("; ")}">${rows.map((r) => {
    const top = r.n === max && r.n > 0 && !r.none && r.n / base >= 0.7;
    return `<div class="obar${top ? " top" : ""}"><span class="ol">${esc(r.label)}</span><div class="track"><i style="width:${total ? (r.n / total) * 100 : 0}%;background:${r.none ? NONE : top ? MAJORITY : MINORITY}"></i></div><span class="ov">${r.n} de ${total}</span></div>`;
  }).join("")}</div>`;
}

function hbars(rows) {
  return `<div class="hbars">${rows.map((r) => `<div class="hbar"><span>${esc(r.label)}</span><div class="track"><i style="width:${Math.round(r.value * 100)}%;background:${r.color}"></i></div><span class="v">${r.text ?? `${Math.round(r.value * 100)} %`}</span></div>`).join("")}</div>`;
}

/* ——— Esquema a escala: pantalla con los componentes superpuestos ——— */
function schematic(list, { fillFirst = true } = {}) {
  const comp = list[0].comp;
  const vw = comp.viewport.w;
  const bottom = Math.max(...list.map((e) => e.comp.box.y + e.comp.box.h));
  const top = Math.max(0, Math.min(...list.map((e) => e.comp.box.y)) - 40);
  const vh = Math.min(Math.max(bottom - top + 40, 120), 1400);
  const pad = vw * 0.03, sw = vw / 250, fs = vw * (vw > 800 ? 0.02 : 0.045);
  const rects = list.map((e, i) => {
    const c = e.comp, y = Math.max(0, c.box.y - top);
    const fill = i === 0 && fillFirst ? c.styles.background : "none";
    return `<rect x="${c.box.x}" y="${y}" width="${c.box.w}" height="${Math.min(c.box.h, vh)}" rx="${Math.min(c.styles.radius, c.box.h / 2)}" fill="${fill}" stroke="${e.color}" stroke-width="${sw}"${i ? ` stroke-dasharray="${vw / 70} ${vw / 110}"` : ""}/>`;
  }).join("");
  const c0 = list[0].comp, y0 = Math.max(0, c0.box.y - top);
  return `<svg class="schematic" viewBox="${-pad} ${-pad} ${vw + pad * 2} ${vh + pad * 2}" role="img" aria-label="Posición y tamaño a escala sobre la pantalla">
<rect x="0" y="0" width="${vw}" height="${vh}" rx="${vw / 120}" fill="#fff" stroke="#E4E8F1" stroke-width="${sw}"/>
${rects}
${fillFirst ? `<text x="${c0.box.x + c0.box.w / 2}" y="${y0 + Math.min(c0.box.h, vh) / 2 + fs / 3}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="${bestTextOn(c0.styles.background)}">${esc(componentByType(c0.type)?.name ?? "")}</text>` : ""}
</svg>`;
}

/** Recorte real del sitio (o esquema medido si todavía no hay foto), con su nombre. */
function specimen(ctx, site, comp, kind = "match") {
  const n = comp ? normalize(comp) : null;
  const visual = !comp ? `<p class="muted" style="margin:0;padding:12px">No tiene este elemento.</p>`
    : comp.crop ? `<img src="${ctx.root}imagenes/${comp.crop}" alt="${esc(componentByType(comp.type)?.name)} de ${esc(site.name)}" loading="lazy">`
    : schematic([{ comp, color: kind === "match" ? "#18B26B" : "#F08A1C" }]);
  return `<figure class="specimen ${kind === "match" ? "" : "other"}"><div class="crop">${visual}</div>
<figcaption>${kind === "match" ? greenFlag() : ""}<span><a href="${link(ctx, `referentes/${site.id}/`)}" style="color:inherit">${esc(site.name)}</a>${n ? `<small>${esc(describeOne(comp).slice(0, 2).map((x) => x[1]).join(" · "))}</small>` : ""}${comp && !comp.crop ? `<small>${comp.method === "demo" ? "Dibujo de ejemplo" : "Dibujo a partir de las medidas"}</small>` : ""}</span></figcaption></figure>`;
}

/** Dibujo simple del componente con sus medidas reales (cuando todavía no hay foto). */
function miniRender(comp) {
  const w = comp.box.w, h = Math.max(comp.box.h, 12);
  const bw = comp.styles.borderWidth ? Math.max(1.5, comp.styles.borderWidth) : 0;
  const fs = Math.min(h * 0.38, w * 0.06, 28);
  return `<svg viewBox="-4 -4 ${w + 8} ${h + 8}" class="mini" role="img" aria-label="Dibujo según las medidas: ${Math.round(w)} por ${Math.round(h)} píxeles"><rect x="0" y="0" width="${w}" height="${h}" rx="${Math.min(comp.styles.radius, h / 2)}" fill="${comp.styles.background}" stroke="${bw ? comp.styles.borderColor ?? "#999" : "#E4E8F1"}" stroke-width="${bw || 1}"/><text x="${w / 2}" y="${h / 2 + fs / 3}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${bestTextOn(comp.styles.background)}" font-family="Nunito, sans-serif">${esc(componentByType(comp.type)?.name ?? "")}</text></svg>`;
}

/** Tira horizontal de imágenes, una por sitio, con el nombre abajo. */
function strip(ctx, items, variant = "") {
  if (!items.length) return "";
  return `<div class="strip ${variant}" tabindex="0" role="region" aria-label="Imágenes de cada sitio">${items.map(({ site, comp, src }) => {
    const img = src ? `<img src="${ctx.root}imagenes/${src}" alt="${esc(site.name)}" loading="lazy">`
      : comp?.crop ? `<img src="${ctx.root}imagenes/${comp.crop}" alt="${esc(componentByType(comp.type)?.name)} de ${esc(site.name)}" loading="lazy">`
      : comp ? miniRender(comp) : "";
    const fake = !src && comp && !comp.crop;
    return `<figure class="shot"><div class="frame">${img}</div><figcaption><a href="${link(ctx, `referentes/${site.id}/`)}">${esc(site.name)}</a>${fake ? `<small>${comp.method === "demo" ? "dibujo de ejemplo" : "dibujo según medidas"}</small>` : ""}</figcaption></figure>`;
  }).join("")}</div>`;
}

/** Tarjeta de una parte: al tocarla se abre grande con su descripción en palabras. */
function partCard(ctx, site, comp, title) {
  const desc = describeOne(comp);
  const big = comp.crop ? `<img src="${ctx.root}imagenes/${comp.crop}" alt="${esc(title)} de ${esc(site.name)}" loading="lazy">` : miniRender(comp);
  return `<button type="button" class="part-card" data-zoom aria-haspopup="dialog">
<span class="part-title">${esc(title)}</span>
<span class="frame">${big}</span>
<span class="part-desc">${esc(desc[0][1])}</span>
<span class="zoom-more">Ver en grande</span>
<template><h3>${esc(title)} · ${esc(site.name)}</h3><div class="zoom-img">${big}</div><dl class="zoom-desc">${desc.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>${comp.crop ? "" : `<p class="muted">Dibujo hecho con las medidas, porque todavía no hay foto.</p>`}</template>
</button>`;
}

// Arma el HTML de un resultado. Se usa al generar el sitio (un país) y también en el navegador
// (cuando se eligen varios países), por eso solo depende de core.mjs y plantillas.mjs.


const DEV = { desktop: "Computadora", mobile: "Celular" };
const PART_NAME = Object.fromEntries(COMPONENTS.map((k) => [k.type, k.name]));

/** Asigna cada sitio a una sola opción (la más frecuente que cumple). */
function assign(v) {
  const taken = new Set();
  const rows = v.alts.map((a) => ({ a, ids: a.matching.filter((id) => !taken.has(id) && taken.add(id)) }));
  const other = v.alts[0].sitesWithComponent.filter((id) => !taken.has(id));
  return { rows, other, absent: v.alts[0].absent };
}

function plainTable(rows) {
  if (!rows.length) return "";
  const yes = rows.filter((r) => r.comun), no = rows.filter((r) => !r.comun);
  return `<div class="plain">
${yes.length ? `<div class="plain-col yes"><h4>${icon("check", "#16A34A", 3)}Lo que tienen en común</h4><dl>${yes.map((r) => `<div><dt>${esc(r.aspecto)}</dt><dd>${esc(r.texto)}</dd></div>`).join("")}</dl></div>` : ""}
${no.length ? `<div class="plain-col no"><h4>${icon("split", "#C2410C", 2.6)}Lo que cambia entre ellos</h4><dl>${no.map((r) => `<div><dt>${esc(r.aspecto)}</dt><dd>${esc(r.texto)}</dd></div>`).join("")}</dl></div>` : ""}
</div>`;
}

/** Gráfico: cuántos líderes coinciden en cada aspecto (verde = 7 de cada 10 o más). */
function aspectChart(rows) {
  if (!rows.length) return "";
  const total = rows[0].total;
  return `<div class="obars" role="img" aria-label="${rows.map((r) => `${esc(r.aspecto)}: ${r.n} de ${total}`).join("; ")}">${rows.map((r) => `<div class="obar${r.comun ? " top" : ""}"><span class="ol">${esc(r.aspecto)}<small>${esc(r.etiqueta)}</small></span><div class="track"><i style="width:${(r.n / total) * 100}%;background:${r.comun ? MAJORITY : "#F08A1C"}"></i></div><span class="ov">${r.n} de ${total}</span></div>`).join("")}</div>`;
}

function deviceColumn(ctx, d, v, ss, comps) {
  const head = `<h3 class="dev-title">${icon(d === "mobile" ? "phone" : "monitor")}${DEV[d]}</h3>`;
  if (!v || v.status === "sin-datos") return `<div class="dev-col" data-dev-col="${d}">${head}<p class="notice" style="margin:0">Todavía no hay fotos suficientes de esta parte en ${DEV[d].toLowerCase()}.</p></div>`;
  const siteOf = (id) => ss.find((s) => s.id === id);
  const compOf = (id) => comps.find((c) => c.siteId === id && c.type === v.type && c.device === d && pageOf(c) === v.page);
  const { rows, other, absent } = assign(v);
  const total = v.valid;
  const bars = [...rows.filter((r) => r.ids.length).map((r) => ({ label: r.a.rule.name, n: r.ids.length })), ...(other.length ? [{ label: "Otra forma", n: other.length }] : []), ...(absent.length ? [{ label: "No lo tienen", n: absent.length, none: true }] : [])];
  const withComp = v.alts[0].sitesWithComponent;
  const items = withComp.map((id) => ({ site: siteOf(id), comp: compOf(id) })).filter((x) => x.site && x.comp);
  const pageComps = comps.filter((c) => c.device === d && pageOf(c) === v.page);
  return `<div class="dev-col" data-dev-col="${d}">${head}
<p class="strip-label">Así lo resuelve cada líder <small>(deslizá para ver todos)</small></p>
${strip(ctx, items)}
${(() => { const rows = describePlain(items.map((x) => x.comp), pageComps); return `${plainTable(rows)}
<div class="chart-box"><h4>Cuántos coinciden en cada aspecto</h4><p class="muted chart-note">De los ${items.length} líderes que tienen esta parte. En verde, donde coinciden 7 de cada 10 o más.</p>${aspectChart(rows)}
<h4 style="margin-top:18px">Opciones que comparamos para la recomendación</h4>${optionBars(bars, total)}</div>`; })()}
</div>`;
}

function componentPanel(ctx, k, verdicts, ss, comps, note, showPage) {
  const [vd, vm] = verdicts;
  const ok = verdicts.filter((v) => v && v.status === "comparten").sort((a, b) => b.best.frequency - a.best.frequency);
  const has = verdicts.filter((v) => v && v.status !== "sin-datos");
  let rec;
  if (ok.length) {
    const main = ok[0];
    rec = `<div class="card recommend"><span class="label">${icon("check", "#16A34A", 3)}Recomendación</span>
<h3>${esc(main.best.rule.name)}</h3>
<p class="big-fact"><b>${main.best.matching.length} de ${main.best.sitesWithComponent.length}</b> líderes que tienen ${esc(k.name.toLowerCase())} lo hacen así${ok.length === 2 ? " en computadora y en celular" : ` en ${DEV[main.device].toLowerCase()}`}.</p>
<p style="margin:0">${esc(main.best.rule.plain)}</p>
<details><summary>Cómo aplicarlo en tu sitio</summary><ol class="steps-list">${main.best.rule.howTo.map((h) => `<li>${esc(h)}</li>`).join("")}</ol></details></div>`;
  } else if (has.length) {
    rec = `<div class="card recommend free"><span class="label">${icon("split", "#C2410C", 2.6)}Sin una forma dominante</span>
<h3>Acá podés elegir con libertad</h3>
<p style="margin:0">Los líderes no se ponen de acuerdo en ${esc(k.name.toLowerCase())}: ninguna forma llega a 7 de cada 10. Abajo ves cómo lo hace cada uno.</p></div>`;
  } else rec = `<div class="notice">Las fotos de esta parte todavía se están sacando.</div>`;
  let diff = "";
  if (vd && vm && vd.status !== "sin-datos" && vm.status !== "sin-datos") {
    const nd = vd.best.rule.name, nm = vm.best.rule.name;
    if (vd.status === "comparten" && vm.status === "comparten") diff = nd === nm ? "Se resuelve igual en computadora y en celular." : `En computadora la mayoría usa «${nd}» y en celular «${nm}».`;
    else if (vd.status === "comparten") diff = `En computadora coinciden («${nd}»), pero en celular cada sitio lo resuelve distinto.`;
    else if (vm.status === "comparten") diff = `En celular coinciden («${nm}»), pero en computadora cada sitio lo resuelve distinto.`;
    else diff = "Tanto en computadora como en celular cada sitio lo resuelve a su manera.";
  }
  return `<h2 class="panel-title">${esc(k.name)}${showPage ? ` <span class="tag">${esc(PAGES[k.page])}</span>` : ""}</h2>
<p class="muted" style="margin:-8px 0 0">${esc(k.hint)}.</p>
${rec}
${note ? `<div class="soft note"><b>Nota del equipo:</b> ${esc(note)}</div>` : ""}
${diff ? `<p class="diff">${icon("info")}<span>${esc(diff)}</span></p>` : ""}
${has.length ? `<div class="dev-switch" role="group" aria-label="Ver en" hidden><button type="button" class="tab" data-dev="desktop">${icon("monitor")}Computadora</button><button type="button" class="tab" data-dev="mobile">${icon("phone")}Celular</button></div>
<div class="dev-grid">${deviceColumn(ctx, "desktop", vd, ss, comps)}${deviceColumn(ctx, "mobile", vm, ss, comps)}</div>` : ""}`;
}

function structureStep(ctx, ss, comps, pages, segName) {
  const blocks = pages.map((pg) => {
    const devs = ["desktop", "mobile"].map((d) => {
      const o = structureOrder(ss, comps, pg, d);
      if (!o) return `<div class="dev-col" data-dev-col="${d}"><p class="notice" style="margin:0">Todavía no hay fotos para ver el orden en ${DEV[d].toLowerCase()}.</p></div>`;
      const shots = ss.filter((s) => s.captures?.[pg === "home" ? d : `${d}_${pg}`]?.screenshot).map((s) => ({ site: s, src: s.captures[pg === "home" ? d : `${d}_${pg}`].screenshot }));
      return `<div class="dev-col" data-dev-col="${d}"><h3 class="dev-title">${icon(d === "mobile" ? "phone" : "monitor")}${DEV[d]}</h3>
<ol class="structure">${o.stats.map((x) => `<li class="${x.present / o.total >= SHARED_MIN ? "yes" : ""}"><span class="sname">${esc(PART_NAME[x.type])}</span><span class="scount">${x.present} de ${o.total}</span></li>`).join("")}</ol>
${shots.length ? `<p class="strip-label">Las páginas completas <small>(deslizá)</small></p>${strip(ctx, shots.map((x) => ({ site: x.site, src: x.src })), "tall")}` : ""}</div>`;
    }).join("");
    return `<div class="stack"><h3>${esc(PAGES[pg])}</h3><div class="dev-grid">${devs}</div></div>`;
  }).join("");
  return `<h2>Estructura general</h2>
<p class="muted">Antes de mirar cada parte: así ordenan sus páginas los líderes de ${esc(segName.toLowerCase())}, de arriba hacia abajo. En verde, lo que tienen 7 de cada 10 o más.</p>
<div class="dev-switch" role="group" aria-label="Ver en" hidden><button type="button" class="tab" data-dev="desktop">${icon("monitor")}Computadora</button><button type="button" class="tab" data-dev="mobile">${icon("phone")}Celular</button></div>
${blocks}`;
}

/**
 * opts: { ctx, title, kicker, segName, pages, ss, intlIds, intlNote, comps, rules, notes, noteKey, countryName, demoLinkHtml }
 */
function resultBody(o) {
  const { ctx, ss, comps, rules } = o;
  const allParts = COMPONENTS.filter((k) => o.pages.includes(k.page));
  const verdictsOf = (k) => ["desktop", "mobile"].map((d) => componentVerdict(rules, ss, comps, k.type, d, k.page));
  const withData = allParts.filter((k) => verdictsOf(k).some((v) => v && v.status !== "sin-datos"));
  // Se muestran solo las partes con fotos suficientes; si todavía no hay ninguna, se muestran todas como «en camino».
  const parts = withData.length ? withData : allParts;
  const pages = o.pages.filter((pg) => parts.some((k) => k.page === pg));
  const hidden = allParts.filter((k) => !parts.includes(k));
  const V = {};
  for (const d of ["desktop", "mobile"]) V[d] = parts.map((k) => componentVerdict(rules, ss, comps, k.type, d, k.page));
  const verdictOf = (k, d) => V[d][parts.indexOf(k)];
  const stepId = (k) => `${k.page}-${k.slug}`;
  const agreement = parts.map((k) => {
    const vs = ["desktop", "mobile"].map((d) => verdictOf(k, d)).filter((v) => v && v.status !== "sin-datos");
    if (!vs.length) return null;
    const best = vs.sort((a, b) => b.best.frequency - a.best.frequency)[0];
    return { k, share: best.best.frequency };
  }).filter(Boolean);
  const yes = agreement.filter((a) => a.share >= SHARED_MIN).length, no = agreement.length - yes;
  const hasCap = (s) => comps.some((c) => c.siteId === s.id);
  const steps = [
    { id: "lideres", title: "Los seleccionados" },
    { id: "resumen", title: "En qué coinciden" },
    { id: "estructura", title: "Estructura general" },
    ...parts.map((k) => ({ id: stepId(k), title: k.name, group: pages.length > 1 ? PAGES[k.page] : "" })),
  ];
  const sections = [];
  sections.push(`<h2 class="h-flag">${greenFlag()}Los seleccionados</h2>
<p class="muted">Los sitios más visitados de ${esc(o.segName.toLowerCase())}${o.kicker ? ` en ${esc(o.kicker)}` : ""}, según estadísticas de tráfico.</p>
<div class="chosen">${ss.map((s) => `<a class="chosen-card" href="${link(ctx, `referentes/${s.id}/`)}"><span class="flag">${greenFlag()}</span><span><b>${esc(s.name)}</b><small>${s.url ? esc(new URL(s.url).hostname.replace(/^www\./, "")) : "sitio ficticio"} · ${esc(o.countryName(s.country))}</small>${o.intlIds.includes(s.id) ? '<small class="intl">Referente de otro país</small>' : ""}${hasCap(s) ? "" : '<small class="pending">Fotos en camino</small>'}</span></a>`).join("")}</div>
${o.intlNote ? `<p class="notice" style="margin-top:16px">${esc(o.intlNote)}</p>` : ""}`);
  sections.push(`<h2>¿En qué coinciden?</h2>
${!agreement.length ? `<div class="notice"><b>Las fotos de estos sitios se están sacando.</b><p style="margin:6px 0 0">En unas horas aparecen acá las comparaciones con sus gráficos.</p>${o.demoLinkHtml ?? ""}</div>` : `
<p class="muted">Cuántos líderes usan la forma más común en cada parte. En verde, donde coinciden 7 de cada 10 o más.</p>
<div class="card"><div class="obars">${agreement.map((a) => `<a class="obar link${a.share >= SHARED_MIN ? " top" : ""}" href="#${stepId(a.k)}" data-goto="${stepId(a.k)}"><span class="ol">${esc(a.k.name)}${pages.length > 1 ? `<small>${esc(PAGES[a.k.page])}</small>` : ""}</span><div class="track"><i style="width:${Math.round(a.share * 100)}%;background:${a.share >= SHARED_MIN ? MAJORITY : "#F08A1C"}"></i></div><span class="ov">${Math.round(a.share * 100)} %</span></a>`).join("")}</div></div>
<div class="verdicts" style="margin-top:18px">
<div class="verdict-col yes"><h3>${icon("check", "#16A34A", 3)}Comparten (${yes})</h3><p class="muted" style="margin:-6px 0 0">Decisión segura: seguí lo que hace la mayoría.</p></div>
<div class="verdict-col no"><h3>${icon("split", "#C2410C", 2.6)}No comparten (${no})</h3><p class="muted" style="margin:-6px 0 0">Tenés libertad para elegir.</p></div>
</div>
${hidden.length && withData.length ? `<p class="muted" style="margin-top:14px">Todavía no hay fotos suficientes para comparar: ${esc(hidden.map((k) => k.name.toLowerCase()).join(", "))}. Aparecen cuando las haya.</p>` : ""}`}`);
  sections.push(structureStep(ctx, ss, comps, pages, o.segName));
  for (const k of parts) sections.push(componentPanel(ctx, k, ["desktop", "mobile"].map((d) => verdictOf(k, d)), ss, comps, o.notes?.[o.noteKey ? `${o.noteKey}/${k.type}` : ""], pages.length > 1));
  const stepNav = (i) => `<div class="step-nav">
${i > 0 ? `<a class="btn2" href="#${steps[i - 1].id}" data-goto="${steps[i - 1].id}">${icon("back")}<span>${esc(steps[i - 1].title)}</span></a>` : "<span></span>"}
${i < steps.length - 1 ? `<a class="pill" href="#${steps[i + 1].id}" data-goto="${steps[i + 1].id}"><span>Siguiente: ${esc(steps[i + 1].title)}</span><span class="ico">${icon("arrow", "#fff")}</span></a>` : btn2(link(ctx, "paleta/"), "Armar mi paleta de colores", "palette")}
</div>`;
  return `<div class="result-head"><div><span class="kicker">${esc(o.kicker ?? "")}</span><h1>${esc(o.title)}</h1></div>${btn2(link(ctx), "Cambiar consulta", "back")}</div>
<nav class="stepper" aria-label="Pasos del resultado"><ol>${steps.map((s, i) => `<li><a href="#${s.id}" data-goto="${s.id}"><span class="dot">${i + 1}</span><span class="t">${esc(s.title)}${s.group ? `<small>${esc(s.group)}</small>` : ""}</span></a></li>`).join("")}</ol></nav>
${sections.map((html, i) => `<section class="rstep" id="${steps[i].id}" data-rstep>${html}${stepNav(i)}</section>`).join("\n")}`;
}

function hasAnyData(ss, comps, rules, pages) {
  const parts = COMPONENTS.filter((k) => pages.includes(k.page));
  return parts.some((k) => ["desktop", "mobile"].some((d) => { const v = componentVerdict(rules, ss, comps, k.type, d, k.page); return v && v.status !== "sin-datos"; }));
}

window.DT = { resultBody, POSITIONS, SEGMENTS, MIN_SAMPLE, COMPONENTS };
})();
