// Arma el HTML de un resultado. Se usa al generar el sitio (un país) y también en el navegador
// (cuando se eligen varios países), por eso solo depende de core.mjs y plantillas.mjs.
import { COMPONENTS, MIN_SAMPLE, PAGES, SHARED_MIN, componentVerdict, describePlain, pageOf, structureOrder } from "./core.mjs";
import { MAJORITY, btn2, esc, greenFlag, icon, link, optionBars, pill, strip } from "./plantillas.mjs";

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
export function resultBody(o) {
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

export function hasAnyData(ss, comps, rules, pages) {
  const parts = COMPONENTS.filter((k) => pages.includes(k.page));
  return parts.some((k) => ["desktop", "mobile"].some((d) => { const v = componentVerdict(rules, ss, comps, k.type, d, k.page); return v && v.status !== "sin-datos"; }));
}
export { MIN_SAMPLE };
