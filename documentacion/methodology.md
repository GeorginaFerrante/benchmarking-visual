# Metodología

1. **Selección:** los referentes salen de rankings públicos de tráfico (ver `documentacion/data-sources.md`). Cada uno guarda fuente y fecha en `datos/references.json`.
2. **Captura:** `pipeline/capture.mjs` abre cada sitio en escritorio (1440 × 900) y celular (390 × 844) con el idioma y la zona horaria del país, cierra banners de cookies cuando puede y detecta bloqueos o CAPTCHA.
3. **Extracción:** para cada componente (header, logo, buscador, menú, banner principal, botón principal, tarjetas, pie de página) busca el elemento en el DOM, mide posición, tamaño, colores, radio, tipografía y presencia de íconos, y guarda un recorte.
4. **Normalización:** las medidas se expresan como proporción del ancho real de maquetación.
5. **Patrones:** `datos/rules.json` define criterios medibles con tolerancias. La frecuencia usa como denominador solo los sitios con captura válida.
6. **Recomendación:** `generador/core.mjs` combina frecuencia (45 %), ajuste al objetivo (30 %) y claridad estimada (25 %). No se calcula con menos de 3 referentes. No es probabilidad de éxito.
7. **Revisión humana:** los casos con confianza «media», cambios bruscos entre capturas y afirmaciones culturales se revisan a mano antes de publicar.
