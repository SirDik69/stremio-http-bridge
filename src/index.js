import { Router } from 'itty-router';

const router = Router();

// ==========================================
// 1. LISTA DE PROVEEDORES (Actualizada con tus URLs funcionales)
// ==========================================
const PROVIDERS = [
  {
    name: "TorrentsDB",
    url: "https://torrentsdb.com/stream"
  },
  {
    name: "Comet", // Usamos el dominio .ru que te funcionó
    url: "https://comet.stremio.ru/stream"
  },
  {
    name: "MediaFusion", // Instancia pública robusta
    url: "https://mediafusionfortheweebs.midnightignite.me/stream"
  },
  {
    name: "TPB+",
    url: "https://thepiratebay-plus.strem.fun/stream"
  }
];

// Headers "Chrome 2026" (Blindados)
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache"
};

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: responseHeaders });

// ==========================================
// 2. UTILS: SANITIZER
// ==========================================
function isIntruder(streamTitle, requestType) {
  if (!streamTitle) return false;
  const title = streamTitle.toUpperCase();
  if (requestType === 'movie') {
    const seriesPatterns = [/S\d\dE\d\d/, /SEASON \d/, /EPISODE \d/, /COMPLETE SERIES/, /S\d\d/];
    if (seriesPatterns.some(pattern => pattern.test(title))) return true;
  }
  return false;
}

// ==========================================
// 3. RUTAS
// ==========================================

router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.parallel.bridge",
    version: "5.0.0",
    name: "Ultimate HTTP Bridge (Parallel)",
    description: "Multi-provider + Parallel Fetching + Sanitizer",
    logo: "https://dl.strem.io/addon-logo.png",
    resources: [
      { name: "stream", types: ["movie", "series"], idPrefixes: ["tt"] },
      { name: "meta", types: ["movie", "series"], idPrefixes: ["tt"] }
    ],
    types: ["movie", "series"],
    catalogs: []
  });
});

router.get('/meta/:type/:id.json', ({ params }) => {
  return json({ meta: { id: params.id.replace(".json", ""), type: params.type, name: "Meta" } });
});

router.get('/stream/:type/:id.json', async (request, env) => {
  let { type, id } = request.params;
  id = decodeURIComponent(id).replace(".json", "");

  if (!env.STREMIO_SERVER_URL) {
    return json({ streams: [{ name: "⚠️ ERROR", title: "Falta STREMIO_SERVER_URL", url: "#" }] });
  }
  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  let allStreams = [];
  let uniqueHashes = new Set();

  // ============================================================
  // EJECUCIÓN PARALELA (La clave para que salgan todos)
  // ============================================================
  
  // 1. Creamos las promesas de todos los proveedores a la vez
  const fetchPromises = PROVIDERS.map(async (provider) => {
    try {
      const response = await fetch(`${provider.url}/${type}/${id}.json`, {
        headers: BROWSER_HEADERS,
        cf: { cacheTtl: 60 }
      });

      if (!response.ok) return []; // Si falla, devolvemos array vacío

      // Intentamos parsear JSON directamente sin verificar headers estrictos
      // (Esto arregla el problema de MediaFusion a veces enviando text/plain)
      const data = await response.json().catch(() => null);

      if (!data || !data.streams) return [];

      // Marcamos el origen para saber quién trajo qué
      return data.streams.map(s => ({ ...s, providerName: provider.name }));
      
    } catch (e) {
      return []; // Ignoramos errores de red individuales
    }
  });

  // 2. Esperamos a que TODOS terminen (Promise.all)
  const results = await Promise.all(fetchPromises);

  // 3. Aplanamos y procesamos los resultados
  results.flat().forEach(stream => {
    // A. Validaciones
    if (!stream.infoHash) return;
    if (uniqueHashes.has(stream.infoHash)) return;
    
    // B. Filtro Sanitario (Anti-Grinch)
    const fullTitle = stream.title || stream.name || "";
    if (isIntruder(fullTitle, type)) return;

    // C. Transformación a HTTP (Tu lógica)
    const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
    const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;
    
    // D. Formateo Visual
    const titleParts = fullTitle.split("\n");
    const cleanTitle = titleParts[0];
    const details = titleParts[1] || `S:${stream.seeders || '?'} • ${stream.providerName}`;

    uniqueHashes.add(stream.infoHash);

    allStreams.push({
      name: `⚡ ${stream.providerName}`, // Mostramos el nombre del proveedor real
      title: `${cleanTitle}\n${details}`,
      url: directUrl,
      behaviorHints: {
        notWebReady: false,
        bingeGroup: stream.behaviorHints?.bingeGroup,
        filename: stream.behaviorHints?.filename
      }
    });
  });

  if (allStreams.length === 0) {
    return json({ streams: [{ name: "⚠️ VACÍO", title: "Ningún proveedor encontró enlaces válidos", url: "#" }] });
  }

  // Opcional: Ordenar por nombre de proveedor para agruparlos visualmente
  allStreams.sort((a, b) => a.name.localeCompare(b.name));

  return json({ streams: allStreams });
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };