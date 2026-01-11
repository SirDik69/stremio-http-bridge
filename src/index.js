import { Router } from 'itty-router';

const router = Router();

// ==========================================
// 1. CONFIGURACIÓN GANADORA (HEADERS + PROVIDERS)
// ==========================================

const PROVIDERS = [
  {
    name: "TorrentsDB",          
    url: "https://torrentsdb.com/stream"
  },
  {
    name: "Torrentio Lite",      
    url: "https://torrentio.strem.fun/stream"
  },
  {
    name: "ThePirateBay+",       
    url: "https://thepiratebay-plus.strem.fun/stream"
  }
];

// Headers "Mágicos" que saltan el bloqueo (Chrome 131)
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

// ==========================================
// 2. RUTAS DEL ADDON
// ==========================================

router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.ultimate.bridge",
    version: "4.0.0",
    name: "Ultimate HTTP Bridge",
    description: "Bypass Cloudflare + HTTP Streamer",
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

router.get('/stream/:type/:id.json', async (request, env) => {
  let { type, id } = request.params;
  id = decodeURIComponent(id).replace(".json", "");

  // VERIFICACIÓN DEL SERVIDOR PROPIO
  if (!env.STREMIO_SERVER_URL) {
    return json({ streams: [{ name: "⚠️ ERROR", title: "Configura STREMIO_SERVER_URL en Cloudflare", url: "#" }] });
  }
  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  let validStreams = [];
  let debugLog = [];

  // ==========================================
  // 3. FETCHING (LÓGICA NUEVA QUE FUNCIONA)
  // ==========================================
  for (const provider of PROVIDERS) {
    try {
      console.log(`Intentando ${provider.name}...`);
      const targetUrl = `${provider.url}/${type}/${id}.json`;

      const response = await fetch(targetUrl, {
        method: "GET",
        headers: BROWSER_HEADERS, // Usamos los headers blindados
        cf: { cacheTtl: 60 }      // Instrucción a Cloudflare
      });

      if (!response.ok) {
        debugLog.push(`${provider.name}: ${response.status}`);
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        continue; // Ignoramos respuestas HTML/Error
      }

      const data = await response.json();

      if (data.streams && data.streams.length > 0) {
        
        // ==========================================
        // 4. TRANSFORMACIÓN (LÓGICA DE TU PROYECTO)
        // ==========================================
        validStreams = data.streams
          .filter(stream => stream.infoHash) // Solo torrents válidos
          .map(stream => {
            
            // A. Recuperamos el índice correcto
            const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
            
            // B. Construimos TU URL PRIVADA (Aquí ocurre la magia)
            // En lugar de devolver magnet:, devolvemos https://tu-server...
            const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;

            // C. Limpieza estética del título
            const titleParts = (stream.title || "Stream").split("\n");
            const cleanTitle = titleParts[0];
            const cleanDetails = titleParts[1] || `S:${stream.seeders || '?'}`;

            return {
              name: `⚡ ${provider.name}`,
              title: `${cleanTitle}\n${cleanDetails}`,
              url: directUrl, // <--- URL HTTP COMPATIBLE CON NUVIO
              behaviorHints: {
                notWebReady: false, // <--- CRUCIAL PARA IOS/NUVIO
                bingeGroup: stream.behaviorHints?.bingeGroup,
                filename: stream.behaviorHints?.filename
              }
            };
          });

        if (validStreams.length > 0) {
          console.log(`¡Éxito con ${provider.name}!`);
          break; // Si funciona, dejamos de buscar
        }
      }
    } catch (e) {
      debugLog.push(`${provider.name}: Error ${e.message}`);
    }
  }

  // Manejo de vacío
  if (validStreams.length === 0) {
    return json({ 
      streams: [{ 
        name: "⚠️ SIN RESULTADOS", 
        title: `No se pudieron cargar enlaces.\nLog: ${debugLog.join(" | ")}`, 
        url: "#" 
      }] 
    });
  }

  return json({ streams: validStreams });
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };