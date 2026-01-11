import { Router } from 'itty-router';

const router = Router();

// ==========================================
// CONFIGURACIÓN DE PROVEEDORES
// ==========================================
// La estrategia es probar uno por uno hasta obtener resultados.
const PROVIDERS = [
  {
    name: "KnightCrawler",
    url: "https://knightcrawler.elfhosted.com/stream" // ElfHosted suele ser permisivo
  },
  {
    name: "TPB+",
    url: "https://tpb.strem.fun/stream" // Simple y efectivo
  },
  {
    name: "Torrentio",
    url: "https://torrentio.strem.fun/stream" // El más estricto (Backup)
  }
];

// Headers estándar para respuesta
const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: responseHeaders });

// ==========================================
// RUTAS
// ==========================================

router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.universal.bridge",
    version: "2.0.0",
    name: "Universal HTTP Bridge",
    description: "Multi-provider Torrent to HTTP bridge (KnightCrawler/TPB/Torrentio)",
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
    meta: {
      id: params.id.replace(".json", ""),
      type: params.type,
      name: "Metadata"
    }
  });
});

router.get('/stream/:type/:id.json', async (request, env) => {
  let { type, id } = request.params;
  id = decodeURIComponent(id).replace(".json", "");

  if (!env.STREMIO_SERVER_URL) {
    return json({ streams: [{ name: "⚠️ ERROR", title: "Configura STREMIO_SERVER_URL", url: "#" }] });
  }
  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  // ==========================================
  // LÓGICA MULTI-PROVEEDOR
  // ==========================================
  
  let validStreams = [];
  let errorLog = [];

  // Iteramos sobre los proveedores hasta encontrar streams
  for (const provider of PROVIDERS) {
    try {
      console.log(`Intentando con ${provider.name}...`);
      
      const targetUrl = `${provider.url}/${type}/${id}.json`;
      
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", // UA genérico
        },
        cf: {
          cacheTtl: 60, // Pedimos a Cloudflare que use caché si es posible
          cacheEverything: true
        }
      });

      if (!response.ok) {
        errorLog.push(`${provider.name}: ${response.status}`);
        continue; // Pasamos al siguiente proveedor
      }

      const data = await response.json();

      if (data.streams && data.streams.length > 0) {
        // ¡ÉXITO! Procesamos los streams de este proveedor
        validStreams = data.streams.map(stream => {
          if (!stream.infoHash) return null;

          const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
          const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;
          
          // Limpieza de título
          const parts = (stream.title || "").split("\n");
          const cleanTitle = parts[0] || "Stream";
          const details = parts[1] || `S:${stream.seeders || '?'} - ${provider.name}`;

          return {
            name: `⚡ ${provider.name}`, // Mostramos qué proveedor funcionó
            title: `${cleanTitle}\n${details}`,
            url: directUrl,
            behaviorHints: {
              notWebReady: false,
              bingeGroup: stream.behaviorHints?.bingeGroup,
              filename: stream.behaviorHints?.filename
            }
          };
        }).filter(Boolean);

        // Si obtuvimos streams válidos, rompemos el bucle y devolvemos
        if (validStreams.length > 0) {
          console.log(`Éxito con ${provider.name}: ${validStreams.length} streams`);
          break; 
        }
      }
    } catch (e) {
      console.error(`Error con ${provider.name}:`, e.message);
      errorLog.push(`${provider.name}: ${e.message}`);
    }
  }

  // Si después de probar todos no hay nada
  if (validStreams.length === 0) {
    return json({ 
      streams: [{ 
        name: "⚠️ SIN RESULTADOS", 
        title: `Fallaron todos los proveedores:\n${errorLog.join("\n")}`, 
        url: "#" 
      }] 
    });
  }

  return json({ streams: validStreams });
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };