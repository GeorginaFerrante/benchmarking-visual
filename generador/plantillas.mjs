// Plantillas HTML del sitio. Todo se genera como texto estático.
import { bestTextOn, componentByType, describeOne, normalize } from "./core.mjs";

export const SITE_URL = "https://georginaferrante.github.io/benchmarking-visual/";
export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Enlace relativo que funciona con doble clic (file://) y en GitHub Pages. */
export const link = (ctx, p = "") => `${ctx.rel}${p}${p === "" || p.endsWith("/") ? "index.html" : ""}`;

/* Paleta de gráficos (saturada, como las referencias) */
export const CHART = ["#18B26B", "#3A6FF8", "#F08A1C", "#EC4F7C", "#8B5CF6", "#12A594", "#E5484D", "#FFC14D"];
/* Sistema de color con significado:
   verde  = acción principal y «lo que hace la mayoría»
   naranja = «varía, tenés libertad»
   gris   = sin datos / opciones minoritarias
   tinta  = selección activa en filtros y pestañas */
export const MAJORITY = "#16A34A", MINORITY = "#94A3B8", NONE = "#D7DCE6";

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
export const icon = (name, color = "currentColor", w = 2.2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
export const greenFlag = () =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 22V3" stroke="#0E7A48" stroke-width="2.4" stroke-linecap="round"/><path d="M5.5 3.5h12.5l-2.6 4.5 2.6 4.5H5.5z" fill="#18B26B"/></svg>`;

/** Botón principal (verde): siempre «avanzar / ver resultado». */
export const pill = (href, text, { size = "", ico = "arrow", attrs = "" } = {}) =>
  `<a class="pill ${size}" href="${href}" ${attrs}><span>${text}</span><span class="ico">${icon(ico, "#fff")}</span></a>`;
/** Botón secundario (blanco con borde): siempre «volver, cambiar, ver más». */
export const btn2 = (href, text, ico = "") => `<a class="btn2" href="${href}">${ico ? icon(ico) : ""}<span>${text}</span></a>`;

/* ——— Página ——— */
export function page(ctx, { path, title, description, body, active = "", jsonLd, index = true }) {
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

export function brandMark() {
  return `<svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="dtg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E40AF"/><stop offset=".55" stop-color="#1C7EEA"/><stop offset="1" stop-color="#14C8B0"/></linearGradient></defs><path d="M6 4h17c11 0 19 8.5 19 20s-8 20-19 20H13L6 37z" fill="url(#dtg)"/><path d="M13 11v26l4 4h6c7.5 0 12.5-7 12.5-17S30.5 7 23 7H13z" fill="#fff" fill-opacity=".14"/><path d="M15 23l6 6 13-13" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export const crumbs = (ctx, items) =>
  `<nav aria-label="Ruta" class="crumbs">${items.map(([href, label], i) => (i < items.length - 1 ? `<a href="${link(ctx, href)}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`)).join(" › ")}</nav>`;

/* ——— Gráficos ——— */
export function donut(value, total, color = "#18B26B", label = "") {
  const r = 52, c = 2 * Math.PI * r, f = total ? value / total : 0;
  return `<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="${value} de ${total}${label ? " " + esc(label) : ""}">
<circle cx="70" cy="70" r="${r}" fill="none" stroke="#EEF1F8" stroke-width="18"/>
<circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 70 70)"/>
<text x="70" y="68" text-anchor="middle" font-size="34" font-weight="900" fill="#1B1F3B">${value}/${total}</text>
<text x="70" y="92" text-anchor="middle" font-size="14" font-weight="700" fill="#5A6080">${Math.round(f * 100)} %</text>
</svg>`;
}

export function stackbar(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return `<div class="stackbar" role="img" aria-label="${parts.map((p) => `${esc(p.label)}: ${p.value}`).join(", ")}">${parts.filter((p) => p.value).map((p) => `<i style="width:${(p.value / total) * 100}%;background:${p.color}"></i>`).join("")}</div>
<ul class="legend">${parts.map((p) => `<li><span style="background:${p.color}"></span>${esc(p.label)} · ${p.value}</li>`).join("")}</ul>`;
}

/** Barras de opciones: la mayoritaria en verde, el resto en gris. */
export function optionBars(rows, total) {
  const max = Math.max(...rows.map((r) => r.n));
  return `<div class="obars" role="img" aria-label="${rows.map((r) => `${esc(r.label)}: ${r.n} de ${total}`).join("; ")}">${rows.map((r) => {
    const top = r.n === max && r.n > 0 && !r.none && r.n / total >= 0.7;
    return `<div class="obar${top ? " top" : ""}"><span class="ol">${esc(r.label)}</span><div class="track"><i style="width:${total ? (r.n / total) * 100 : 0}%;background:${r.none ? NONE : top ? MAJORITY : MINORITY}"></i></div><span class="ov">${r.n} de ${total}</span></div>`;
  }).join("")}</div>`;
}

export function hbars(rows) {
  return `<div class="hbars">${rows.map((r) => `<div class="hbar"><span>${esc(r.label)}</span><div class="track"><i style="width:${Math.round(r.value * 100)}%;background:${r.color}"></i></div><span class="v">${r.text ?? `${Math.round(r.value * 100)} %`}</span></div>`).join("")}</div>`;
}

/* ——— Esquema a escala: pantalla con los componentes superpuestos ——— */
export function schematic(list, { fillFirst = true } = {}) {
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
export function specimen(ctx, site, comp, kind = "match") {
  const n = comp ? normalize(comp) : null;
  const visual = !comp ? `<p class="muted" style="margin:0;padding:12px">No tiene este elemento.</p>`
    : comp.crop ? `<img src="${ctx.root}imagenes/${comp.crop}" alt="${esc(componentByType(comp.type)?.name)} de ${esc(site.name)}" loading="lazy">`
    : schematic([{ comp, color: kind === "match" ? "#18B26B" : "#F08A1C" }]);
  return `<figure class="specimen ${kind === "match" ? "" : "other"}"><div class="crop">${visual}</div>
<figcaption>${kind === "match" ? greenFlag() : ""}<span><a href="${link(ctx, `referentes/${site.id}/`)}" style="color:inherit">${esc(site.name)}</a>${n ? `<small>${esc(describeOne(comp).slice(0, 2).map((x) => x[1]).join(" · "))}</small>` : ""}${comp && !comp.crop ? `<small>${comp.method === "demo" ? "Dibujo de ejemplo" : "Dibujo a partir de las medidas"}</small>` : ""}</span></figcaption></figure>`;
}

/** Dibujo simple del componente con sus medidas reales (cuando todavía no hay foto). */
export function miniRender(comp) {
  const w = comp.box.w, h = Math.max(comp.box.h, 12);
  const bw = comp.styles.borderWidth ? Math.max(1.5, comp.styles.borderWidth) : 0;
  const fs = Math.min(h * 0.38, w * 0.06, 28);
  return `<svg viewBox="-4 -4 ${w + 8} ${h + 8}" class="mini" role="img" aria-label="Dibujo según las medidas: ${Math.round(w)} por ${Math.round(h)} píxeles"><rect x="0" y="0" width="${w}" height="${h}" rx="${Math.min(comp.styles.radius, h / 2)}" fill="${comp.styles.background}" stroke="${bw ? comp.styles.borderColor ?? "#999" : "#E4E8F1"}" stroke-width="${bw || 1}"/><text x="${w / 2}" y="${h / 2 + fs / 3}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${bestTextOn(comp.styles.background)}" font-family="Nunito, sans-serif">${esc(componentByType(comp.type)?.name ?? "")}</text></svg>`;
}

/** Tira horizontal de imágenes, una por sitio, con el nombre abajo. */
export function strip(ctx, items, variant = "") {
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
export function partCard(ctx, site, comp, title) {
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
