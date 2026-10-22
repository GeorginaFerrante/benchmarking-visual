/* DesignTrust · interacciones. Script clásico (no módulo): funciona también con doble clic.
   Todo el contenido ya está en el HTML; esto solo ordena lo que se ve. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var params = new URLSearchParams(location.search);
  var setParam = function (k, v) {
    if (v) params.set(k, v); else params.delete(k);
    var q = params.toString();
    try { history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash); } catch (e) {}
  };

  /* ——— Consulta en pasos ——— */
  var form = $("#consulta");
  if (form) {
    var idx = JSON.parse(form.getAttribute("data-index"));
    var all = $$(".step", form), bar = $(".progress i", form), msg = $("[data-msg]", form), i = 0;
    var val = function (n) { var c = $('input[name="' + n + '"]:checked', form); return c ? c.value : null; };
    var paises = function () { return $$('input[name="pais"]:checked', form).map(function (x) { return x.value; }); };
    var active = function () { return all.filter(function (s) { return s.getAttribute("data-step") !== "compite" || val("tipo") === "tienda-online"; }); };
    var show = function () {
      var st = active();
      all.forEach(function (s) { s.hidden = s !== st[i]; });
      st.forEach(function (s, k) { var n = $("[data-n]", s); if (n) n.textContent = (k + 1) + " de " + st.length; });
      bar.style.width = ((i + 1) / st.length) * 100 + "%";
      $("[data-back]", form).style.visibility = i === 0 ? "hidden" : "visible";
      var cur = st[i].getAttribute("data-step");
      $("[data-finish]", form).hidden = i !== st.length - 1 || (cur === "pais" ? !paises().length : val(cur) === null);
      var cnt = $("[data-sel-count]", form), ps = paises();
      if (cnt) cnt.textContent = ps.length ? (ps.length === 1 ? "1 país elegido." : ps.length + " países elegidos.") : "";
      msg.hidden = true;
    };
    var next = function () { if (i === 0 && !paises().length) { msg.hidden = false; return; } i++; show(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    all.forEach(function (s) {
      $$("input", s).forEach(function (inp) {
        inp.addEventListener("change", function () {
          if (inp.type === "checkbox") { show(); return; }
          if (i < active().length - 1) setTimeout(next, 200); else show();
        });
      });
    });
    $$("[data-next]", form).forEach(function (b) { b.addEventListener("click", next); });
    $("[data-back]", form).addEventListener("click", function () { if (i > 0) { i--; show(); } });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ps = paises(), tipo = val("tipo"), comp = val("compite");
      if (!ps.length || !tipo) { msg.hidden = false; return; }
      var withSeg = ps.filter(function (p) { return idx[p].segs.indexOf(tipo) >= 0; });
      if (!withSeg.length) { location.href = "resultado/sin-datos/index.html?pais=" + ps[0] + "&tipo=" + tipo; return; }
      if (ps.length === 1) { location.href = "resultado/" + idx[ps[0]].slug + "/" + tipo + "/" + (tipo === "tienda-online" && comp ? comp + "/" : "") + "index.html"; return; }
      location.href = "resultado/varios/index.html?paises=" + ps.join(",") + "&tipo=" + tipo + (tipo === "tienda-online" && comp ? "&compite=" + comp : "");
    });
    show();
  }

  /* ——— Resultado de varios países: se arma acá con los mismos datos ——— */
  var app = $("#app");
  if (app && window.DT && window.DT_DATA) {
    var D = window.DT_DATA, DT = window.DT;
    var codes = (params.get("paises") || "").split(",").filter(Boolean), tipo = params.get("tipo"), compite = params.get("compite");
    var seg = DT.SEGMENTS.filter(function (g) { return g.slug === tipo; })[0];
    var pos = DT.POSITIONS.filter(function (x) { return x.slug === compite; })[0];
    var cname = function (code) { var c = D.countries.filter(function (x) { return x.code === code; })[0]; return c ? c.name : code; };
    if (!seg || !codes.length) { app.innerHTML = '<p class="notice">Faltan datos de la consulta. <a href="../../index.html">Volver a empezar</a></p>'; }
    else {
      var ss = D.sites.filter(function (s) { return codes.indexOf(s.country) >= 0 && seg.types.indexOf(s.siteType) >= 0 && (!pos || s.positioning === pos.slug); });
      var intl = [];
      if (pos && ss.length < DT.MIN_SAMPLE) intl = D.sites.filter(function (s) { return codes.indexOf(s.country) < 0 && seg.types.indexOf(s.siteType) >= 0 && s.positioning === pos.slug; }).slice(0, Math.max(0, 6 - ss.length));
      var label = seg.name + (pos ? " que compite por " + pos.name.toLowerCase() : "");
      var names = codes.map(cname);
      document.title = label + " en " + names.join(", ") + " · DesignTrust";
      app.innerHTML = DT.resultBody({
        ctx: { rel: app.getAttribute("data-rel"), root: app.getAttribute("data-root"), prefix: "", demo: app.getAttribute("data-demo") === "1", meta: {} },
        title: label, kicker: names.join(" + "), segName: label, pages: seg.pages, ss: ss.concat(intl), intlIds: intl.map(function (s) { return s.id; }),
        comps: D.comps, rules: D.rules, notes: D.notes, noteKey: codes.length === 1 ? codes[0] + "/" + seg.slug : "", countryName: cname,
        intlNote: intl.length ? "Entre los países elegidos hay pocas tiendas líderes que compitan por " + pos.name.toLowerCase() + ", así que sumamos referentes de otros países que compiten igual." : "",
        demoLinkHtml: ""
      });
    }
  }

  /* ——— Resultado en pasos ——— */
  var rsteps = $$("[data-rstep]");
  if (rsteps.length) {
    var links = $$(".stepper a");
    var go = function (id, scroll) {
      var target = rsteps.filter(function (s) { return s.id === id; })[0] || rsteps[0];
      rsteps.forEach(function (s) { s.hidden = s !== target; });
      var n = rsteps.indexOf(target);
      links.forEach(function (a, k) {
        a.parentNode.className = k < n ? "done" : k === n ? "current" : "";
        if (k === n) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current");
      });
      var cur = links[n]; if (cur && cur.parentNode.parentNode.parentNode.scrollTo) { var nav = cur.closest(".stepper"); nav.scrollLeft = cur.offsetLeft - nav.clientWidth / 2 + cur.clientWidth / 2; }
      try { history.replaceState(null, "", "#" + target.id); } catch (e) {}
      if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
    };
    $$("[data-goto]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); go(a.getAttribute("data-goto"), true); }); });
    go(location.hash.slice(1));
    setTimeout(function () { window.scrollTo(0, 0); }, 0);
    window.addEventListener("hashchange", function () { go(location.hash.slice(1)); });
    var setDev = function (d) {
      $$("[data-dev-col]").forEach(function (c) { c.hidden = c.getAttribute("data-dev-col") !== d; });
      $$("[data-dev]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-dev") === d)); });
    };
    $$(".dev-switch").forEach(function (g) { g.hidden = false; });
    $$("[data-dev]").forEach(function (b) { b.addEventListener("click", function () { setDev(b.getAttribute("data-dev")); }); });
    setDev("desktop");
  }

  /* ——— Sin datos: ofrecer alternativas reales ——— */
  var sd = $("#sin-datos");
  if (sd) {
    var ix = JSON.parse(sd.getAttribute("data-index")), segs = JSON.parse(sd.getAttribute("data-segs"));
    var pais = params.get("pais"), tipo = params.get("tipo"), alts = $("[data-alts]", sd), out = [];
    if (ix[pais] && segs[tipo]) $("[data-detail]", sd).textContent = "Todavía no analizamos «" + segs[tipo].toLowerCase() + "» en " + ix[pais].name + ". No inventamos datos: preferimos mostrarte solo lo que medimos.";
    if (ix[pais]) ix[pais].segs.forEach(function (s) { out.push([ix[pais].slug + "/" + s, segs[s] + " en " + ix[pais].name]); });
    Object.keys(ix).forEach(function (k) { if (k !== pais && ix[k].segs.indexOf(tipo) >= 0) out.push([ix[k].slug + "/" + tipo, segs[tipo] + " en " + ix[k].name]); });
    alts.innerHTML = out.slice(0, 10).map(function (o) { return '<a class="answer" style="color:var(--ink);text-decoration:none" href="../' + o[0] + '/index.html">' + o[1] + "</a>"; }).join("") || "<span class='muted'>Probá con otro país.</span>";
  }

  /* ——— Paleta 60-30-10 ——— */
  var ds = $("#ds");
  if (ds) {
    var rgb = function (h) { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join(""); var v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
    var lum = function (h) { var a = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
    var ratio = function (a, b) { var x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
    var on = function (bg) { return ratio(bg, "#FFFFFF") >= ratio(bg, "#111111") ? "#FFFFFF" : "#111111"; };
    var PRESETS = [
      { id: "fresca", name: "Fresca", why: "Blanco con verde y un acento cálido para los botones.", t: { base: "#FFFFFF", secondary: "#0E7A48", accent: "#D9480F", text: "#1B1F3B", font: "Nunito", radius: 14 } },
      { id: "confianza", name: "Confianza", why: "Fondo claro y azul profundo, muy usado para transmitir orden.", t: { base: "#FFFFFF", secondary: "#1F3A68", accent: "#B4530A", text: "#14213D", font: "Nunito", radius: 8 } },
      { id: "ofertas", name: "Ofertas a la vista", why: "Amarillo fuerte arriba y rojo para comprar.", t: { base: "#FFFFFF", secondary: "#FFE600", accent: "#D7263D", text: "#1A1A1A", font: "Nunito", radius: 6 } },
      { id: "suave", name: "Suave", why: "Tonos lavanda y bordes muy redondeados.", t: { base: "#F7F4FF", secondary: "#5B3FD9", accent: "#00806A", text: "#221B3A", font: "Nunito", radius: 22 } }
    ];
    var t = Object.assign({}, PRESETS[0].t), cur = PRESETS[0].id;
    var pres = $("[data-presets]", ds);
    pres.innerHTML = PRESETS.map(function (p) { return '<button type="button" class="chip" role="radio" data-p="' + p.id + '">' + p.name + "</button>"; }).join("");
    $$("[data-p]", pres).forEach(function (b) { b.addEventListener("click", function () { var p = PRESETS.filter(function (x) { return x.id === b.getAttribute("data-p"); })[0]; t = Object.assign({}, p.t); cur = p.id; draw(); }); });
    ["base", "secondary", "accent", "text"].forEach(function (k) {
      $('[data-color="' + k + '"]', ds).addEventListener("input", function (e) { t[k] = e.target.value.toUpperCase(); cur = ""; draw(); });
      $('[data-hex="' + k + '"]', ds).addEventListener("input", function (e) { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { t[k] = e.target.value.toUpperCase(); cur = ""; draw(true); } });
    });
    $("[data-font]", ds).addEventListener("change", function (e) { t.font = e.target.value; cur = ""; draw(); });
    $("[data-radius]", ds).addEventListener("input", function (e) { t.radius = Number(e.target.value); cur = ""; draw(); });
    var css = function () {
      return ":root {\n  /* Regla 60-30-10 */\n  --color-base: " + t.base + ";       /* 60 % fondos */\n  --color-secondary: " + t.secondary + ";  /* 30 % header y secciones */\n  --color-accent: " + t.accent + ";     /* 10 % botones */\n  --color-text: " + t.text + ";\n  --color-on-secondary: " + on(t.secondary) + ";\n  --color-on-accent: " + on(t.accent) + ";\n  --font-family: \"" + t.font + "\", system-ui, sans-serif;\n  --radius: " + t.radius + "px;\n  --space-1: 4px; --space-2: 8px; --space-3: 16px; --space-4: 24px; --space-5: 40px;\n}";
    };
    var json = function () { return JSON.stringify({ base: t.base, secondary: t.secondary, accent: t.accent, text: t.text, onSecondary: on(t.secondary), onAccent: on(t.accent), font: t.font, radius: t.radius }, null, 2); };
    var draw = function (fromHex) {
      $$("[data-p]", pres).forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-p") === cur)); });
      var p = PRESETS.filter(function (x) { return x.id === cur; })[0];
      $("[data-why]", ds).textContent = p ? p.why : "Paleta personalizada.";
      ["base", "secondary", "accent", "text"].forEach(function (k) {
        $('[data-color="' + k + '"]', ds).value = t[k].toLowerCase();
        if (!fromHex) $('[data-hex="' + k + '"]', ds).value = t[k];
        var s = $('[data-sw="' + k + '"]', ds); if (s) { s.style.background = t[k]; s.style.color = on(t[k]); }
      });
      $("[data-font]", ds).value = t.font; $("[data-radius]", ds).value = t.radius; $("[data-radius-label]", ds).textContent = t.radius;
      var checks = [["Texto sobre el fondo", ratio(t.text, t.base), 4.5], ["Texto sobre el secundario", ratio(on(t.secondary), t.secondary), 4.5], ["Texto del botón", ratio(on(t.accent), t.accent), 4.5], ["Botón sobre el fondo", ratio(t.accent, t.base), 3]];
      $("[data-checks]", ds).innerHTML = checks.map(function (c) { var ok = c[1] >= c[2]; return "<tr><td>" + c[0] + '</td><td><span class="tag ' + (ok ? "ok" : "warn") + '">' + (ok ? "Se lee bien" : "Se lee mal") + "</span></td></tr>"; }).join("");
      $("[data-check-warn]", ds).hidden = checks.every(function (c) { return c[1] >= c[2]; });
      var r = t.radius + "px";
      $("[data-preview]", ds).innerHTML = '<div style="background:' + t.base + ";color:" + t.text + ";font-family:'" + t.font + "',system-ui\">" +
        '<div style="background:' + t.secondary + ";color:" + on(t.secondary) + ';padding:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><b>Tu marca</b><div style="flex:1;min-width:140px;background:#fff;color:#555;border-radius:' + r + ';padding:8px 12px;font-size:14px">Buscar…</div></div>' +
        '<div style="padding:18px;display:grid;gap:14px"><b style="font-size:1.2rem">Título de sección</b><span>Texto de ejemplo para ver cómo se lee.</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        [1, 2].map(function (i) { return '<div style="border:1px solid ' + t.secondary + "33;border-radius:" + r + ';padding:12px"><div style="height:56px;background:' + t.secondary + "22;border-radius:" + Math.max(0, t.radius - 4) + 'px;margin-bottom:8px"></div><b>Producto ' + i + "</b></div>"; }).join("") +
        '</div><span style="background:' + t.accent + ";color:" + on(t.accent) + ";border-radius:" + r + ';padding:12px 18px;font-weight:800;justify-self:start">Comprar</span></div></div>';
      $("[data-css]", ds).textContent = css();
    };
    var status = $("[data-status]", ds);
    $$("[data-copy]", ds).forEach(function (b) {
      b.addEventListener("click", function () {
        var txt = b.getAttribute("data-copy") === "css" ? css() : json();
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { status.textContent = "¡Copiado!"; }, function () { status.textContent = "No se pudo copiar: seleccioná el texto a mano."; });
        else status.textContent = "Seleccioná el texto a mano para copiarlo.";
      });
    });
    $$("[data-download]", ds).forEach(function (b) {
      b.addEventListener("click", function () {
        var url = URL.createObjectURL(new Blob([css()], { type: "text/css" }));
        var a = document.createElement("a"); a.href = url; a.download = "paleta.css"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      });
    });
    draw();
  }
})();

/* Partes ampliables: al tocar una tarjeta se abre en grande con su descripción.
   Se escucha en todo el documento, así funciona aunque la tarjeta se toque mientras la página termina de cargar. */
(function () {
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-zoom]") : null;
    var dlg = document.getElementById("zoom");
    if (b && dlg && dlg.showModal) {
      var body = dlg.querySelector(".zoom-body");
      body.innerHTML = "";
      body.appendChild(b.querySelector("template").content.cloneNode(true));
      dlg.showModal();
      return;
    }
    if (dlg && dlg.open && (e.target === dlg || (e.target.closest && e.target.closest("[data-close]")))) dlg.close();
  });
})();
