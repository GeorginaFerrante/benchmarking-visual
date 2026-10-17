// Genera el sitio estático completo en /docs (lo que publica GitHub Pages).
// Uso: npm run sitio
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPONENTS, MIN_SAMPLE, PAGES, POSITIONS, SEGMENTS, SHARED_MIN, WEIGHTS, componentVerdict, computePattern, describeCommon, groupCountries, isLight, pageOf, segmentOf, sentence, slugify } from "./core.mjs";
import { CHART, MAJORITY, SITE_URL, btn2, crumbs, esc, greenFlag, hbars, icon, link, page, pill, specimen, stackbar } from "./plantillas.mjs";
import { hasAnyData, resultBody } from "./resultado.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = path.join(ROOT, "docs");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "datos", f), "utf8"));
const countries = read("countries.json");
const siteTypes = read("site-types.json");
const rules = read("rules.json");
const insights = read("insights.json");
const meta = read("meta.json");
const siteTypeName = (id) => siteTypes.find((t) => t.id === id)?.name ?? id;
const cSlug = (code) => slugify(countries.find((c) => c.code === code)?.name ?? code);
const cName = (code) => countries.find((c) => c.code === code)?.name ?? code;
const SEG_COLORS = ["#18B26B", "#3A6FF8", "#8B5CF6", "#12A594", "#F08A1C", "#EC4F7C", "#E5484D", "#FFC14D"];
const DEV = { desktop: "Computadora", mobile: "Celular" };
const urls = [];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, "assets"), path.join(OUT, "assets"), { recursive: true });
fs.cpSync(path.join(ROOT, "datos/imagenes"), path.join(OUT, "imagenes"), { recursive: true });
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
{
  const src = ["core.mjs", "plantillas.mjs", "resultado.mjs"].map((f) => fs.readFileSync(path.join(ROOT, "generador", f), "utf8")
    .replace(/^import [^;]+;\s*$/gm, "").replace(/^export \{[^}]*\};?\s*$/gm, "").replace(/^export (const|function|let)/gm, "$1")).join("\n");
  fs.writeFileSync(path.join(OUT, "assets", "motor.js"), `/* DesignTrust · motor de resultados para el navegador (generado). */\n(function(){\n${src}\nwindow.DT = { resultBody, POSITIONS, SEGMENTS, MIN_SAMPLE, COMPONENTS };\n})();\n`);
}

build({ sites: read("references.json"), comps: read("components.json"), demo: false });
build({ sites: read("demo-references.json"), comps: read("demo-components.json"), demo: true });

fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE_URL}${u}</loc><lastmod>${meta.generatedAt}</lastmod></url>`).join("\n")}\n</urlset>`);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /benchmarking-visual/demo/\nSitemap: ${SITE_URL}sitemap.xml\n`);
console.log(`Sitio generado en docs/: ${urls.length} páginas indexables (+ ejemplo en docs/demo/).`);

function build({ sites, comps, demo }) {
  const prefix = demo ? "demo/" : "";
  // Páginas sin mediciones: noindex y fuera del sitemap hasta tener datos.
  const write = (p, html) => {
    const file = path.join(OUT, prefix, p, p.endsWith(".html") ? "" : "index.html");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    if (!demo && !p.endsWith(".html") && !html.includes('content="noindex"')) urls.push(p);
  };
  const ctxFor = (p) => {
    const depth = p === "" ? 0 : p.split("/").filter(Boolean).length;
    return { rel: "../".repeat(depth), root: "../".repeat(depth + (demo ? 1 : 0)), prefix, demo, meta };
  };
  const sitesIn = (code, seg) => sites.filter((s) => s.country === code && (!seg || seg.types.includes(s.siteType)));
  const segsOf = (code) => SEGMENTS.filter((g) => sitesIn(code, g).length);
  const hasCaptures = (ss) => ss.some((s) => Object.values(s.captures ?? {}).some((c) => c?.status === "ok"));
  const index = Object.fromEntries(countries.map((c) => [c.code, { slug: cSlug(c.code), name: c.name, segs: segsOf(c.code).map((g) => g.slug) }]));
  const demoLink = (ctx, to = "resultado/argentina/tienda-online/") => (demo ? "" : `<p style="margin:14px 0 0">${btn2(`${ctx.root}demo/${to}index.html`, "Ver un ejemplo de cómo se verá")}</p>`);

  /* ═══ Inicio: consulta en pasos (una pregunta por pantalla) ═══ */
  const notes = (() => { try { return read("notas.json"); } catch { return {}; } })();
  const available = countries.map((c) => ({ c, segs: segsOf(c.code) })).filter((x) => x.segs.length);
  {
    const p = "", ctx = ctxFor(p);
    const opt = (name, value, inner) => `<label class="type"><input type="radio" name="${name}" value="${value}">${inner}</label>`;
    write(p, page(ctx, {
      path: p, active: "home", title: "DesignTrust · ¿Qué diseño necesita mi sitio web?",
      description: "Elegí tu país, tu rubro y cómo competís, y mirá qué decisiones de diseño comparten los sitios más visitados. Gratis.",
      jsonLd: { "@context": "https://schema.org", "@type": "WebSite", name: "DesignTrust", url: SITE_URL, inLanguage: "es" },
      body: `<form class="wizard" id="consulta" data-index='${esc(JSON.stringify(index))}'>
<div class="progress" aria-hidden="true"><i></i></div>
<fieldset class="step" data-step="pais"><legend><span class="kicker">Pregunta <span data-n>1</span></span><h1>¿En qué países está tu público?</h1></legend>
<p class="muted">Podés marcar uno o varios. Vamos a mirar a los sitios más visitados de esos países. <span class="sel-count" data-sel-count></span></p>
<div class="types">${countries.map((c) => `<label class="type"><input type="checkbox" name="pais" value="${c.code}"><span class="check-ico" aria-hidden="true"></span><span><b>${esc(c.name)}</b><small>${sitesIn(c.code).length ? `${sitesIn(c.code).length} sitios analizados` : "Próximamente"}</small></span></label>`).join("")}</div>
<div class="wizard-inline"><button type="button" class="pill" data-next><span>Siguiente</span><span class="ico">${icon("arrow", "#fff")}</span></button></div></fieldset>
<fieldset class="step" data-step="tipo"><legend><span class="kicker">Pregunta <span data-n>2</span></span><h1>¿Qué tipo de sitio es?</h1></legend>
<div class="types">${SEGMENTS.map((g) => opt("tipo", g.slug, `${icon(g.icon)}<span><b>${esc(g.name)}</b><small>${esc(g.hint)}</small></span>`)).join("")}</div></fieldset>
<fieldset class="step" data-step="compite"><legend><span class="kicker">Pregunta <span data-n>3</span></span><h1>¿Cómo compite tu tienda?</h1></legend>
<p class="muted">No es lo mismo vender barato que vender lujo: los líderes de cada grupo se diseñan distinto.</p>
<div class="types">${POSITIONS.map((x) => opt("compite", x.slug, `${icon(x.icon)}<span><b>${esc(x.name)}</b><small>${esc(x.hint)}</small></span>`)).join("")}${opt("compite", "", `${icon("list")}<span><b>No sé o de todo un poco</b><small>Ver todas las tiendas líderes</small></span>`)}</div></fieldset>
<p class="msg" data-msg hidden>Elegí una opción para seguir.</p>
<div class="wizard-nav">
<button type="button" class="btn2" data-back>${icon("back")}<span>Volver</span></button>
<button type="submit" class="pill" data-finish><span>Ver qué hacen los líderes</span><span class="ico">${icon("arrow", "#fff")}</span></button>
</div>
<noscript><p class="notice">Sin JavaScript, elegí en <a href="${link(ctx, "consultas/")}">la lista de consultas</a>.</p></noscript>
</form>
<p class="home-foot muted"><a href="${link(ctx, "consultas/")}">Ver todas las consultas disponibles</a> · <a href="${link(ctx, "explorar/")}">Comparar diseño entre regiones</a></p>`,
    }));
  }

  /* ═══ Directorio de consultas ═══ */
  {
    const p = "consultas/", ctx = ctxFor(p);
    write(p, page(ctx, {
      path: p, title: "Todas las consultas disponibles", description: "Países y tipos de sitio con análisis de diseño de sus sitios líderes.",
      body: `<h1>Todas las consultas</h1><div class="directory">${available.map(({ c, segs }) => `<div class="dir-item"><b>${esc(c.name)}</b><div>${segs.map((g) => `<a href="${link(ctx, `resultado/${cSlug(c.code)}/${g.slug}/`)}">${esc(g.name)}</a>${g.slug === "tienda-online" ? POSITIONS.map((x) => `<a class="sub" href="${link(ctx, `resultado/${cSlug(c.code)}/${g.slug}/${x.slug}/`)}">· ${esc(x.name.toLowerCase())}</a>`).join("") : ""}`).join("")}</div></div>`).join("")}</div>`,
    }));
  }

  /* ═══ Sin datos ═══ */
  {
    const p = "resultado/sin-datos/", ctx = ctxFor(p);
    write(p, page(ctx, {
      path: p, index: false, title: "Todavía no tenemos esa combinación", description: "Combinación de país y tipo de sitio sin datos todavía.",
      body: `<div class="narrow stack" id="sin-datos" data-index='${esc(JSON.stringify(index))}' data-segs='${esc(JSON.stringify(Object.fromEntries(SEGMENTS.map((g) => [g.slug, g.name]))))}'>
<h1>Todavía no analizamos ese tipo de sitio en ese país</h1>
<p class="lead" data-detail>No inventamos datos: preferimos mostrarte solo lo que medimos.</p>
<div class="soft"><h3>Podés ver alguno de estos</h3><div class="row" data-alts></div></div>
${btn2(link(ctx), "Hacer otra consulta", "back")}
</div>`,
    }));
  }

  /* ═══ Resultados ═══ */
  for (const c of countries) for (const g of segsOf(c.code)) {
    const all = sitesIn(c.code, g);
    renderResult(`resultado/${cSlug(c.code)}/${g.slug}/`, c, g, null, all, []);
    if (g.slug !== "tienda-online") continue;
    for (const pos of POSITIONS) {
      const local = all.filter((s) => s.positioning === pos.slug);
      // Si en el país hay menos de 3, se suman líderes de otros países que compiten igual (primero de la misma región).
      let intl = [];
      if (local.length < MIN_SAMPLE) {
        const region = countries.find((x) => x.code === c.code).region;
        const pool = sites.filter((s) => s.country !== c.code && g.types.includes(s.siteType) && s.positioning === pos.slug);
        const same = pool.filter((s) => countries.find((x) => x.code === s.country)?.region === region);
        intl = [...same, ...pool.filter((s) => !same.includes(s))].slice(0, Math.max(0, 6 - local.length));
      }
      renderResult(`resultado/${cSlug(c.code)}/${g.slug}/${pos.slug}/`, c, g, pos, [...local, ...intl], intl.map((s) => s.id));
    }
  }

  function renderResult(p, c, g, pos, ss, intlIds) {
    const ctx = ctxFor(p);
    const label = `${g.name}${pos ? ` que compite por ${pos.name.toLowerCase()}` : ""}`;
    write(p, page(ctx, {
      path: p, index: hasAnyData(ss, comps, rules, g.pages),
      title: `Diseño de ${label.toLowerCase()} en ${c.name}: qué hacen los líderes`,
      description: `Qué decisiones de diseño comparten ${ss.slice(0, 4).map((s) => s.name).join(", ")} y otros líderes de ${label.toLowerCase()} en ${c.name}.`,
      body: resultBody({ ctx, title: label, kicker: c.name, segName: label, pages: g.pages, ss, intlIds, comps, rules, notes, noteKey: `${c.code}/${g.slug}`, countryName: cName,
        intlNote: intlIds.length ? `En ${c.name} hay pocas tiendas líderes que compitan por ${pos.name.toLowerCase()}, así que sumamos referentes de otros países que compiten igual.` : "",
        demoLinkHtml: demoLink(ctx) }),
    }));
  }

  /* ═══ Varios países (se arma en el navegador con los mismos datos) ═══ */
  {
    const p = "resultado/varios/", ctx = ctxFor(p);
    write(p, page(ctx, {
      path: p, index: false, title: "Resultado para varios países", description: "Qué comparten los sitios líderes de varios países.",
      body: `<div id="app" data-rel="${ctx.rel}" data-root="${ctx.root}" data-demo="${demo ? 1 : 0}"><p class="notice">Preparando el resultado…</p></div>
<noscript><p class="notice">Para combinar varios países hace falta JavaScript.</p></noscript>
<script src="${ctx.root}assets/datos-${demo ? "demo" : "real"}.js"></script>
<script src="${ctx.root}assets/motor.js"></script>`,
    }));
    const slim = (c) => ({ siteId: c.siteId, page: c.page, device: c.device, type: c.type, region: c.region, box: c.box, viewport: c.viewport, styles: c.styles, hasIcon: c.hasIcon, crop: c.crop, method: c.method });
    fs.writeFileSync(path.join(OUT, "assets", `datos-${demo ? "demo" : "real"}.js`), `window.DT_DATA=${JSON.stringify({ sites, comps: comps.map(slim), rules, countries: countries.map((c) => ({ code: c.code, name: c.name, region: c.region })), notes })};`);
  }

  /* ═══ Referentes ═══ */
  for (const s of sites) {
    const p = `referentes/${s.id}/`, ctx = ctxFor(p);
    const own = comps.filter((c) => c.siteId === s.id);
    const g = segmentOf(s.siteType);
    write(p, page(ctx, {
      path: p, title: `${s.name}: cómo está diseñado su sitio`,
      description: `Análisis visual del sitio de ${s.name} (${cName(s.country)}): header, buscador, menú, botones y más, medidos y recortados.`,
      body: `${crumbs(ctx, [["explorar/", "Explorar"], [`explorar/${cSlug(s.country)}/`, cName(s.country)], [p, s.name]])}
<div class="row" style="gap:16px"><span class="flag" style="width:56px;height:56px;display:grid;place-items:center;border-radius:16px;background:#E3F7EC">${greenFlag()}</span><h1 style="margin:0">${esc(s.name)}</h1></div>
<div class="grid grid-2 section" style="margin-top:28px">
<div class="soft stack">
<p style="margin:0"><b>Rubro:</b> ${esc(siteTypeName(s.siteType))}${s.url ? ` · <a href="${esc(s.url)}" rel="nofollow noopener" target="_blank">${esc(new URL(s.url).hostname)}</a>` : ""}</p>
<p style="margin:0"><b>Por qué es referente:</b> ${esc(s.reason)}</p>
<p style="margin:0"><b>Fuente:</b> ${s.sources.map((src) => (src.url ? `<a href="${esc(src.url)}" rel="nofollow noopener" target="_blank">${esc(src.title)}</a>` : esc(src.title))).join(", ")}</p>
${g ? pill(link(ctx, `resultado/${cSlug(s.country)}/${g.slug}/`), "Compararlo con los demás líderes", { size: "small" }) : ""}
</div>
<div class="soft"><b>Fotos</b><ul>${Object.entries(s.captures ?? {}).map(([k, v]) => `<li>${esc(k.replace("desktop", "Computadora").replace("mobile", "Celular").replace("_ficha", ", ficha").replace("_categoria", ", categoría"))}: ${v?.status === "ok" ? `${esc(v.date)}${v.stale ? " (posiblemente desactualizada)" : ""}` : v?.status === "fallida" ? "no se pudo sacar" : "pendiente"}</li>`).join("")}</ul></div>
</div>
${s.captures?.desktop?.screenshot ? `<img class="screenshot" src="${ctx.root}imagenes/${s.captures.desktop.screenshot}" alt="Inicio de ${esc(s.name)} en computadora" loading="lazy">` : ""}
${own.length ? `<section class="section"><h2>Sus partes, una por una</h2><div class="specimens">${own.map((c) => `<div><span class="tag" style="margin-bottom:6px">${esc(COMPONENTS.find((k) => k.type === c.type)?.name)} · ${DEV[c.device]}</span>${specimen(ctx, s, c, "match")}</div>`).join("")}</div></section>` : ""}`,
    }));
  }

  /* ═══ Explorar regiones ═══ */
  const storeSeg = SEGMENTS[0];
  const keyRules = ["search-desktop-wide", "nav-desktop-horizontal", "logo-desktop-left", "button-desktop-pill", "header-desktop-light", "hero-desktop-full"].map((id) => rules.find((r) => r.id === id)).filter(Boolean);
  const freqOf = (code, r) => { const x = computePattern(r, sitesIn(code, storeSeg), comps); return x.validSites.length >= MIN_SAMPLE ? x.frequency : null; };
  const withData = countries.filter((c) => keyRules.some((r) => freqOf(c.code, r) !== null));
  const vectors = Object.fromEntries(withData.map((c) => [c.code, Object.fromEntries(keyRules.map((r) => [r.id, freqOf(c.code, r)]).filter(([, v]) => v !== null))]));
  const groups = groupCountries(vectors);
  const accentColors = (code) => comps.filter((k) => sitesIn(code).some((s) => s.id === k.siteId) && ["primary_button", "buy_button"].includes(k.type) && k.device === "desktop").map((k) => k.styles.background);
  const headerTone = (code) => { const hs = comps.filter((k) => k.type === "header" && k.device === "desktop" && pageOf(k) === "home" && sitesIn(code).some((s) => s.id === k.siteId)); return { light: hs.filter((h) => isLight(h.styles.background)).length, dark: hs.filter((h) => !isLight(h.styles.background)).length }; };
  const uniq = (a) => [...new Set(a)].slice(0, 8);
  const shortName = { "search-desktop-wide": "Buscador ancho", "nav-desktop-horizontal": "Menú a la vista", "logo-desktop-left": "Logo a la izquierda", "button-desktop-pill": "Botones redondeados", "header-desktop-light": "Header claro", "hero-desktop-full": "Banner a todo el ancho" };
  {
    const p = "explorar/", ctx = ctxFor(p);
    const regions = [...new Set(countries.map((c) => c.region))];
    const groupColors = ["#0F172A", "#334155", "#475569", "#1E3A5F", "#3F3F46", "#164E63"];
    const traits = (grp) => keyRules.filter((r) => grp.every((c) => (vectors[c][r.id] ?? 0) >= 0.6)).map((r) => shortName[r.id]);
    write(p, page(ctx, {
      path: p, active: "explorar", index: withData.length > 0,
      title: "Diseño web en otras regiones: colores, estructura y patrones por país",
      description: "Compará cómo se diseñan los sitios en Argentina, Estados Unidos, China y otros países: uso del color, estructura y grupos de países que diseñan parecido.",
      body: `<h1>Diseño web en otras regiones</h1>
<p class="lead muted">Cómo cambian los colores, la estructura y las costumbres de diseño de un país a otro. Comparamos las tiendas online líderes de cada país, en computadora.</p>
${!withData.length ? `<div class="notice"><b>Las comparaciones entre países se arman con las fotos de los sitios.</b><p style="margin:6px 0 0">Ya están elegidos los líderes de cada país; los gráficos aparecen con la primera actualización.</p>${demoLink(ctx, "explorar/")}</div>` : `
<section class="section" style="margin-top:28px"><h2>Países que diseñan parecido</h2>
<div class="groups">${groups.map((grp, i) => `<div class="group" style="background:${groupColors[i % groupColors.length]}"><b>Grupo ${i + 1}</b><div class="chips">${grp.map((c) => `<span>${esc(cName(c))}</span>`).join("")}</div><p>${traits(grp).length ? `Coinciden en: ${traits(grp).join(", ").toLowerCase()}.` : "Diseñan parecido en general, sin un rasgo que compartan todos."}</p></div>`).join("")}</div>
<p class="muted" style="margin-top:10px">Agrupamos países cuando sus líderes usan los mismos patrones en proporciones parecidas. Describe lo que hacen los sitios, no lo que prefiere la gente.</p></section>
<section class="section"><h2>Cómo usan el color</h2><div class="grid grid-2">
${withData.map((c) => { const t = headerTone(c.code); return `<div class="soft"><h3><a href="${link(ctx, `explorar/${cSlug(c.code)}/`)}" style="color:inherit">${esc(c.name)}</a></h3>${stackbar([{ label: "Header claro", value: t.light, color: "#E2E8F0" }, { label: "Header oscuro o de color", value: t.dark, color: "#334155" }])}<p style="margin:12px 0 6px;font-weight:800">Colores de sus botones principales</p><div class="swatches">${uniq(accentColors(c.code)).map((h) => `<span style="background:${h}" title="${h}"></span>`).join("")}</div></div>`; }).join("")}
</div></section>
<section class="section"><h2>Estructura</h2><div class="grid grid-2">
${keyRules.map((r) => `<div class="soft"><h3>${esc(shortName[r.id])}</h3>${hbars(withData.map((c) => ({ label: c.name, value: vectors[c.code][r.id] ?? 0, color: (vectors[c.code][r.id] ?? 0) >= SHARED_MIN ? MAJORITY : "#94A3B8" })))}</div>`).join("")}
</div></section>`}
<section class="section"><h2>Todos los países</h2>
${regions.map((r) => `<h3 style="margin-top:22px">${esc(r)}</h3><div class="region-grid">${countries.filter((c) => c.region === r).map((c) => `<a class="country" href="${link(ctx, `explorar/${cSlug(c.code)}/`)}"><span class="code-badge">${c.code}</span><span><b>${esc(c.name)}</b><small>${sitesIn(c.code).length ? `${sitesIn(c.code).length} sitios líderes` : "Próximamente"}</small></span></a>`).join("")}</div>`).join("")}
</section>`,
    }));

    for (const c of countries) {
      const cp = `explorar/${cSlug(c.code)}/`, cctx = ctxFor(cp);
      const own = sitesIn(c.code);
      const segs = segsOf(c.code);
      const vec = vectors[c.code];
      const t = headerTone(c.code);
      const rel = insights.filter((i) => i.countries.includes(c.code));
      write(cp, page(cctx, {
        path: cp, active: "explorar", index: own.length > 0,
        title: `Diseño web en ${c.name}: sitios líderes y patrones`,
        description: own.length ? `Cómo diseñan sus sitios ${own.slice(0, 4).map((s) => s.name).join(", ")} y otros líderes de ${c.name}.` : `Diseño web en ${c.name}: próximamente.`,
        body: `${crumbs(cctx, [["explorar/", "Explorar regiones"], [cp, c.name]])}
<h1>Diseño web en ${esc(c.name)}</h1>
${!own.length ? `<div class="notice">Todavía no analizamos sitios de ${esc(c.name)}. No inventamos datos: cuando lo agreguemos aparece acá.</div>` : `
<section class="section" style="margin-top:20px"><h2>Líderes por tipo de sitio</h2><div class="stack">
${segs.map((g, i) => `<div class="soft"><div class="row between"><h3 style="margin:0">${esc(g.name)}</h3>${pill(link(cctx, `resultado/${cSlug(c.code)}/${g.slug}/`), "Ver qué comparten", { size: "small" })}</div><div class="row" style="margin-top:12px;gap:8px">${sitesIn(c.code, g).map((s) => `<a class="answer" href="${link(cctx, `referentes/${s.id}/`)}" style="color:var(--ink);text-decoration:none">${esc(s.name)}</a>`).join("")}</div></div>`).join("")}
</div></section>
${vec ? `<section class="section"><h2>Así diseñan sus tiendas online</h2><div class="grid grid-2"><div class="soft">${hbars(keyRules.filter((r) => vec[r.id] !== undefined).map((r) => ({ label: shortName[r.id], value: vec[r.id], color: vec[r.id] >= SHARED_MIN ? MAJORITY : "#94A3B8" })))}</div>
<div class="soft"><h3>Color</h3>${stackbar([{ label: "Header claro", value: t.light, color: "#E2E8F0" }, { label: "Header oscuro o de color", value: t.dark, color: "#334155" }])}<p style="margin:12px 0 6px;font-weight:800">Botones principales</p><div class="swatches">${uniq(accentColors(c.code)).map((h) => `<span style="background:${h}" title="${h}"></span>`).join("")}</div></div></div></section>` : ""}`}
${rel.length ? `<section class="section"><h2>Curiosidades</h2><div class="stack">${rel.map((i) => `<div class="soft"><span class="tag ${i.evidence === "hipotesis" ? "warn" : "ok"}">${i.evidence === "hipotesis" ? "Hipótesis a verificar" : "Observado"}</span><p style="margin:10px 0 6px"><b>${esc(i.claim)}</b></p><p class="muted" style="margin:0">${esc(i.context)}</p></div>`).join("")}</div></section>` : ""}`,
      }));
    }
  }

  /* ═══ Paleta, cómo funciona, cobertura ═══ */
  { const p = "paleta/", ctx = ctxFor(p); write(p, page(ctx, { path: p, title: "Armá la paleta de colores de tu sitio (60-30-10)", description: "Generador gratuito de paletas 60-30-10 con contraste accesible verificado. Copiá tus colores como CSS o JSON.", body: paletteBody() })); }
  { const p = "como-funciona/", ctx = ctxFor(p); write(p, page(ctx, { path: p, title: "Cómo funciona DesignTrust", description: "Cómo elegimos a los sitios líderes, cómo medimos su diseño y cómo decidimos qué comparten.", body: howBody(ctx) })); }
  {
    const p = "cobertura/", ctx = ctxFor(p);
    const rows = countries.flatMap((c) => { const sg = segsOf(c.code); return sg.length ? sg.map((g) => { const ss = sitesIn(c.code, g); return `<tr><td>${esc(c.name)}</td><td><a href="${link(ctx, `resultado/${cSlug(c.code)}/${g.slug}/`)}">${esc(g.name)}</a></td><td>${ss.length}</td><td>${hasCaptures(ss) ? '<span class="tag ok">Con fotos</span>' : '<span class="tag warn">Fotos en camino</span>'}</td></tr>`; }) : [`<tr><td>${esc(c.name)}</td><td>—</td><td>0</td><td><span class="tag">Próximamente</span></td></tr>`]; });
    write(p, page(ctx, { path: p, title: "Qué países y rubros tenemos", description: "Países y tipos de sitio analizados en DesignTrust.", body: `<h1>Qué países y rubros tenemos</h1><p class="muted">Actualizado el ${esc(meta.generatedAt)}.</p><div class="table-wrap card"><table><thead><tr><th>País</th><th>Tipo de sitio</th><th>Líderes</th><th>Estado</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>` }));
  }
  if (!demo) {
    const ctx = { rel: "/benchmarking-visual/", root: "/benchmarking-visual/", prefix: "", demo: false, meta };
    fs.writeFileSync(path.join(OUT, "404.html"), page(ctx, { path: "404", index: false, title: "Página no encontrada", description: "Esta página no existe.", body: `<div class="home-hero"><h1>Esta página no existe</h1><p class="lead">Puede que la dirección haya cambiado.</p>${pill("/benchmarking-visual/index.html", "Ir al inicio")}</div>` }));
  }
}

function paletteBody() {
  return `<h1>Armá la paleta de tu sitio</h1>
<p class="lead muted">La regla 60-30-10: un color base para el 60 % (fondos), uno secundario para el 30 % (header, secciones) y un acento para el 10 % (botones). Verificamos que todo se lea bien.</p>
<div id="ds">
<div class="soft"><h2 style="font-size:1.3rem">Elegí un punto de partida</h2><div class="choice-grid" role="radiogroup" aria-label="Paletas sugeridas" data-presets></div><p class="muted" data-why style="margin:10px 0 0"></p></div>
<div class="grid grid-2" style="margin-top:20px">
<div class="card stack"><h2 style="font-size:1.3rem;margin:0">Tus colores</h2>
<div class="ds-swatches" aria-hidden="true"><div data-sw="base">60 %</div><div data-sw="secondary">30 %</div><div data-sw="accent">10 %</div></div>
${[["base", "Base (60 %)"], ["secondary", "Secundario (30 %)"], ["accent", "Acento (10 %)"], ["text", "Texto"]].map(([k, l]) => `<div class="color-row"><label for="c-${k}">${l}</label><input id="c-${k}" type="color" data-color="${k}"><input type="text" aria-label="${l} en hexadecimal" data-hex="${k}"></div>`).join("")}
<div class="field"><label for="font">Tipografía</label><select id="font" data-font>${["Nunito", "Georgia", "system-ui", "Verdana"].map((f) => `<option>${f}</option>`).join("")}</select></div>
<div class="field"><label for="radius">Redondeo de bordes: <span data-radius-label></span> px</label><input id="radius" type="range" min="0" max="28" data-radius></div>
<h3 style="margin:0">¿Se lee bien?</h3><table><tbody data-checks></tbody></table>
<p class="notice" data-check-warn hidden>Alguna combinación se lee mal. Ajustá los colores marcados antes de usarlos.</p>
</div>
<div class="card stack"><h2 style="font-size:1.3rem;margin:0">Así se vería</h2><div class="preview" data-preview></div></div>
</div>
<div class="card stack" style="margin-top:20px"><h2 style="font-size:1.3rem;margin:0">Llevátela</h2>
<div class="row"><button type="button" class="pill small" data-copy="css"><span>Copiar CSS</span><span class="ico">${icon("check", "#fff")}</span></button><button type="button" class="pill small blue" data-copy="json"><span>Copiar JSON</span><span class="ico">${icon("check", "#fff")}</span></button><button type="button" class="pill small ghost" data-download="css"><span>Descargar CSS</span><span class="ico">${icon("arrow")}</span></button><span role="status" class="muted" data-status></span></div>
<pre data-css></pre></div>
</div><noscript><p class="notice">El editor necesita JavaScript.</p></noscript>`;
}

function howBody(ctx) {
  return `<div class="wizard stack"><h1>Cómo funciona</h1>
<div class="soft"><h2 style="font-size:1.3rem">1. Elegimos a los líderes con estadísticas</h2><p style="margin:0">Usamos rankings públicos de tráfico (Ahrefs para la mayoría de los países; para China, datos de usuarios activos, porque allí esos rankings no son fiables). Cada sitio muestra su fuente.</p></div>
<div class="soft"><h2 style="font-size:1.3rem">2. Sacamos fotos y medimos</h2><p style="margin:0">Todos los meses un programa abre cada sitio en computadora y en celular, encuentra cada parte (header, buscador, menú, botones, fotos de producto, filtros…) y mide su tamaño, posición, colores y redondeo.</p></div>
<div class="soft"><h2 style="font-size:1.3rem">3. Vemos qué comparten</h2><p style="margin:0">Si el ${Math.round(SHARED_MIN * 100)} % o más de los líderes resuelve una parte de la misma forma, decimos que la comparten y te la recomendamos. Si no, te mostramos cómo se reparten las opciones. Con menos de ${MIN_SAMPLE} sitios con fotos no sacamos conclusiones.</p></div>
<div class="soft"><h2 style="font-size:1.3rem">Lo que conviene saber</h2><ul style="margin:0"><li>Que los líderes lo hagan igual es una señal fuerte, pero no garantiza más ventas.</li><li>Algunos sitios bloquean las fotos automáticas; esos aparecen como «fotos en camino» o se usa su última foto válida.</li><li>Mostramos recortes de cada sitio con su nombre, solo para analizar y comparar.</li><li>Pesos internos de la recomendación: frecuencia ${WEIGHTS.frequency * 100} %, objetivo ${WEIGHTS.objective * 100} %, claridad ${WEIGHTS.clarity * 100} % (heurística a validar).</li></ul></div>
${pill(link(ctx), "Hacer una consulta")}</div>`;
}
