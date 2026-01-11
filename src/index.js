import { Router } from 'itty-router';

const router = Router();

// ==========================================
// CONFIGURACIÓN DE PROVEEDORES (2026 - Enero)
// ==========================================
const PROVIDERS = [
  {
    name: "TorrentsDB",          // Mejor opción actual: fork de Torrentio + más providers (incluye TPB, Knaben, etc.)
    url: "https://torrentsdb.com/stream"
  },
  {
    name: "Torrentio Lite",      // Versión ligera, a veces mejor para bypass
    url: "https://torrentio.strem.fun/lite/stream"
  },
  {
    name: "ThePirateBay+",       // Directo desde TPB+ (último recurso, puede fallar más)
    url: "https://thepiratebay-plus.strem.fun/stream"
  }
];

// User-Agent realista (Chrome 2026) + extras para evitar detección
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Referer": "https://www.stremio.com/",
  "Origin": "https://www.stremio.com",
  "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin"
};

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: responseHeaders });

router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.universal.bridge.tpb-torrentsdb",
    version: "3.1.0",
    name: "Universal Bridge (TorrentsDB + Torrentio Lite + TPB)",
    description: "Agrega streams de TorrentsDB, Torrentio Lite y ThePirateBay+ (2026)",
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
  return json({
    meta: { id: params.id.replace(".json", ""), type: params.type, name: "Metadata Bridge" }
  });
});

router.get('/stream/:type/:id.json', async (request) => {
  let { type, id } = request.params;
  id = decodeURIComponent(id).replace(".json", "");

  let validStreams = [];
  let debugLog = [];

  for (const provider of PROVIDERS) {
    try {
      console.log(`Intentando ${provider.name} para ${type}/${id}`);
      const targetUrl = `${provider.url}/${type}/${id}.json`;

      const response = await fetch(targetUrl, {
        method: "GET",
        headers: BROWSER_HEADERS,
        cache: 'no-store'  // Evita cache Cloudflare que puede dar stale 403
      });

      debugLog.push(`${provider.name}: HTTP ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Sin texto');
        debugLog.push(`${provider.name}: Error body → ${errorText.substring(0, 100)}...`);
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        debugLog.push(`${provider.name}: No es JSON (posible bloqueo HTML)`);
        continue;
      }

      const data = await response.json();

      if (data.streams && Array.isArray(data.streams) && data.streams.length > 0) {
        validStreams = data.streams
          .filter(stream => stream.infoHash)  // Solo streams válidos con infoHash
          .map(stream => {
            const fileIdx = stream.fileIdx ?? 0;
            // Aquí pones tu servidor de streams (si usas uno propio para servir el magnet/torrent)
            // Si no tienes servidor, cambia a magnetURI o http si el addon lo soporta
            const directUrl = `magnet:?xt=urn:btih:${stream.infoHash}`; // Ejemplo básico

            const titleParts = (stream.title || "Stream").split("\n");
            const mainTitle = titleParts[0] || "Video";
            const extra = titleParts[1] || `Seeds: ${stream.seeders ?? '?'}`;

            return {
              name: `🔥 ${provider.name}`,
              title: `${mainTitle}\n${extra}`,
              url: directUrl,
              behaviorHints: {
                notWebReady: true,  // Cambia a false si usas servidor http directo
                bingeGroup: stream.behaviorHints?.bingeGroup,
                filename: stream.behaviorHints?.filename
              },
              sources: stream.sources || []  // Si quieres pasar más info
            };
          });

        if (validStreams.length > 0) {
          debugLog.push(`${provider.name}: ¡Éxito! ${validStreams.length} streams`);
          break;  // Salimos al encontrar algo bueno
        }
      } else {
        debugLog.push(`${provider.name}: 0 streams válidos`);
      }
    } catch (e) {
      debugLog.push(`${provider.name}: Excepción → ${e.message}`);
    }
  }

  if (validStreams.length === 0) {
    return json({
      streams: [{
        name: "⚠️ SIN STREAMS",
        title: `Debug: ${debugLog.join(" | ")}\nPrueba con debrid o VPN`,
        url: "#"
      }]
    });
  }

  return json({ streams: validStreams });
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };