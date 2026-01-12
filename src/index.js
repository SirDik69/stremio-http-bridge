import { Router } from 'itty-router';

const router = Router();

// ==========================================
// 1. PROVEEDORES
// ==========================================
const PROVIDERS = [
  {
    name: "TorrentsDB",
    url: "https://torrentsdb.com/eyJxdWFsaXR5ZmlsdGVyIjpbIjcyMHAiLCI0ODBwIiwib3RoZXIiLCJzY3IiLCJjYW0iLCJ1bmtub3duIl0sImxpbWl0IjoiMTAifQ==/stream"
  },
  {
    name: "Comet", 
    url: "https://comet.stremio.ru/eyJtYXhSZXN1bHRzUGVyUmVzb2x1dGlvbiI6MTAsIm1heFNpemUiOjAsImNhY2hlZE9ubHkiOmZhbHNlLCJzb3J0Q2FjaGVkVW5jYWNoZWRUb2dldGhlciI6ZmFsc2UsInJlbW92ZVRyYXNoIjp0cnVlLCJyZXN1bHRGb3JtYXQiOlsidGl0bGUiLCJ2aWRlb19pbmZvIiwicXVhbGl0eV9pbmZvIiwicmVsZWFzZV9ncm91cCIsInNlZWRlcnMiLCJzaXplIiwidHJhY2tlciIsImxhbmd1YWdlcyJdLCJkZWJyaWRTZXJ2aWNlIjoidG9ycmVudCIsImRlYnJpZEFwaUtleSI6IiIsImRlYnJpZFN0cmVhbVByb3h5UGFzc3dvcmQiOiIiLCJsYW5ndWFnZXMiOnsiZXhjbHVkZSI6W10sInByZWZlcnJlZCI6W119LCJyZXNvbHV0aW9ucyI6eyJyNzIwcCI6ZmFsc2UsInI0ODBwIjpmYWxzZSwicjM2MHAiOmZhbHNlLCJ1bmtub3duIjpmYWxzZX0sIm9wdGlvbnMiOnsicmVtb3ZlX3JhbmtzX3VuZGVyIjotMTAwMDAwMDAwMDAsImFsbG93X2VuZ2xpc2hfaW5fbGFuZ3VhZ2VzIjpmYWxzZSwicmVtb3ZlX3Vua25vd25fbGFuZ3VhZ2VzIjpmYWxzZX19/stream"
  },
  {
    name: "MediaFusion", 
    url: "https://mediafusionfortheweebs.midnightignite.me/D-bnynm9kKEjRv75F-la-LIHO9o6ibRtdI0u_D0Y9mhwIPJxqbp_OAH30QqxsFoIQ_qF-_g47cflaiSLgV894b9P4M0t248YyqcXaBFMgJKZ2puo66JJQzdajIbA6KsAL8cb9AkqtS-eNTTTYbdV_Ql-7Lxf1gHkzPPv7CjXLg7sVe3lrv_JlL2-pMr4Wn63GzXfDjuAhWwBSVtiBe1NN2bmcMBBOkE5evSKxAyBz8AylLOmstkcXfwVhoKPSpEuQJ/stream"
  },
  {
    name: "AIOStreams",
    url: "https://aiostreamsfortheweebs.midnightignite.me/stremio/0479360b-f14a-4dff-b7b5-32d70809a4e7/eyJpdiI6IlR0RU1ubWU5NjNJSnFpOVhHVUpzdlE9PSIsImVuY3J5cHRlZCI6IlcwdGd6aEFZNFl1amJzVmhZVFdJRnc9PSIsInR5cGUiOiJhaW9FbmNyeXB0In0/stream"
  }
];

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Cache-Control": "no-cache"
};

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: responseHeaders });

// ==========================================
// 2. SMART PARSER (MOTOR VISUAL)
// ==========================================
function analyzeStream(stream, providerName) {
  // Recopilamos TODA la información disponible en un solo texto para analizar
  const filename = stream.behaviorHints?.filename || "";
  const title = stream.title || "";
  const name = stream.name || "";
  
  // Texto maestro para análisis (Mayúsculas para regex)
  const fullText = `${title} ${filename} ${name}`.toUpperCase();
  
  // --- 1. DETECCIÓN DE CALIDAD ---
  let quality = "HD";
  if (fullText.includes("4K") || fullText.includes("2160P") || fullText.includes("UHD")) quality = "4K [UHD]";
  else if (fullText.includes("1080P") || fullText.includes("FHD")) quality = "1080p [FHD]";
  
  // --- 2. DETECCIÓN DE FUENTE ---
  let source = "☁️ WEB-DL"; // Default común
  if (fullText.includes("BLURAY") || fullText.includes("BLU-RAY") || fullText.includes("BD")) source = "💿 BluRay";
  else if (fullText.includes("DVD")) source = "📀 DVD";
  else if (fullText.includes("CAM")) source = "📹 CAM";
  // Si ya estaba WEB-DL o WEB, se queda el default, pero si detectamos HDR lo mejoramos
  
  // --- 3. DETECCIÓN DE EXTRAS (HDR, AUDIO, CODEC) ---
  const extras = [];
  
  // Video
  if (fullText.includes("HDR") || fullText.includes("10BIT")) extras.push("🌈 HDR");
  if (fullText.includes("DOLBY VISION") || fullText.includes("DV")) extras.push("👁️ DV");
  if (fullText.includes("HEVC") || fullText.includes("X265") || fullText.includes("H.265")) extras.push("⚙️ x265");
  if (fullText.includes("AV1")) extras.push("⚙️ AV1");
  
  // Audio
  if (fullText.includes("DUAL") || fullText.includes("MULTI") || fullText.includes("LATINO")) extras.push("🗣️ Dual/Multi");
  else if (fullText.includes("5.1") || fullText.includes("7.1") || fullText.includes("ATMOS")) extras.push("🔊 Surround");

  // --- 4. TAMAÑO ---
  let sizeStr = "";
  if (stream.behaviorHints?.videoSize) {
    sizeStr = (stream.behaviorHints.videoSize / 1073741824).toFixed(2) + " GB";
  } else {
    // Intentar regex
    const match = fullText.match(/(\d+(\.\d+)?)\s?GB/);
    if (match) sizeStr = match[0];
  }

  // --- 5. LIMPIEZA DEL NOMBRE DEL ARCHIVO ---
  // Usamos el filename real si existe, si no el title.
  let cleanName = filename || title;
  cleanName = cleanName
    .replace(/\[TORRENT\]/gi, "")
    .replace(/\[ok\]/gi, "")
    .replace(/MediaFusion/gi, "")
    .replace(/Comet/gi, "")
    .replace(/unknown/gi, "")
    .replace(/2160p/gi, "") // Quitamos info técnica redundante del nombre
    .replace(/1080p/gi, "")
    .replace(/WEB-DL/gi, "")
    .replace(/\./g, " ") // Puntos por espacios para leer mejor
    .trim();

  // Si el nombre quedó muy corto o vacío, ponemos algo genérico
  if (cleanName.length < 3) cleanName = "Video File";

  // --- 6. CONSTRUCCIÓN DE LA TARJETA ---
  
  // Línea 1: Iconos Técnicos
  const line1Parts = [sizeStr ? `📦 ${sizeStr}` : null, source, ...extras].filter(Boolean);
  // Limitamos a 4 items en línea 1 para que no se desborde
  const line1 = line1Parts.slice(0, 4).join("  ");

  // Línea 2: Provider y Seeds
  const seeds = stream.seeders !== undefined ? `🌱 ${stream.seeders}` : "";
  const line2 = [`🏷️ ${providerName}`, seeds].filter(Boolean).join("   ");

  return {
    badge: `⚡ ${quality}`,
    description: `${line1}\n${line2}\n📄 ${cleanName}`
  };
}

// Filtro Anti-Intrusos
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
    id: "com.nuvio.visual.ultimate",
    version: "8.0.0",
    name: "Ultimate Bridge (Deep Scan)",
    description: "Deep metadata inspection for Comet & MediaFusion",
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

  const fetchPromises = PROVIDERS.map(async (provider) => {
    try {
      const response = await fetch(`${provider.url}/${type}/${id}.json`, {
        headers: BROWSER_HEADERS,
        cf: { cacheTtl: 60 }
      });

      if (!response.ok) return [];
      const data = await response.json().catch(() => null);
      if (!data || !data.streams) return [];
      return data.streams.map(s => ({ ...s, providerName: provider.name }));
    } catch (e) { return []; }
  });

  const results = await Promise.all(fetchPromises);

  results.flat().forEach(stream => {
    if (!stream.infoHash) return;
    if (uniqueHashes.has(stream.infoHash)) return;

    // Filtro Intrusos
    const checkTitle = stream.title || stream.behaviorHints?.filename || "";
    if (isIntruder(checkTitle, type)) return;

    // Construcción URL
    const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
    const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;
    
    // ANÁLISIS VISUAL PROFUNDO
    const visual = analyzeStream(stream, stream.providerName);

    uniqueHashes.add(stream.infoHash);

    allStreams.push({
      name: visual.badge, // Ej: ⚡ 4K [UHD]
      title: visual.description, // Descripción rica generada por nosotros
      url: directUrl,
      behaviorHints: {
        notWebReady: false,
        bingeGroup: stream.behaviorHints?.bingeGroup,
        filename: stream.behaviorHints?.filename
      }
    });
  });

  if (allStreams.length === 0) {
    return json({ streams: [{ name: "⚠️ VACÍO", title: "Sin resultados", url: "#" }] });
  }

  // Ordenar por Calidad (4K > 1080p) y luego por Peso
  allStreams.sort((a, b) => {
    // 1. Calidad
    const is4kA = a.name.includes("4K");
    const is4kB = b.name.includes("4K");
    if (is4kA !== is4kB) return is4kB - is4kA; // 4K primero
    
    // 2. Si es la misma calidad, intentar ordenar por peso (buscando GB en la descripción)
    // Esto es un hack visual simple
    const sizeA = parseFloat((a.title.match(/(\d+\.?\d*) GB/) || ['0'])[1]);
    const sizeB = parseFloat((b.title.match(/(\d+\.?\d*) GB/) || ['0'])[1]);
    return sizeB - sizeA; // Mayor peso primero
  });

  return json({ streams: allStreams });
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };