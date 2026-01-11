import { Router } from 'itty-router';

const router = Router();

// Headers CORS que ya comprobamos que funcionan
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: corsHeaders });

// URL de Torrentio "Standard" (Providers comunes + Calidad)
// Usamos esta para garantizar resultados.
const TORRENTIO_BASE = "https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,magnetdl,torrentgalaxy|quality=720p,1080p,4k,scr,cam";

// 1. MANIFEST (Formato que le gustó a Nuvio)
router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.httpbridge",
    version: "1.1.0",
    name: "HTTP Bridge",
    description: "Convierte Torrents a HTTPS Directo",
    logo: "https://dl.strem.io/addon-logo.png",
    resources: [
      { name: "stream", types: ["movie", "series"], idPrefixes: ["tt"] },
      { name: "meta", types: ["movie", "series"], idPrefixes: ["tt"] }
    ],
    types: ["movie", "series"],
    catalogs: []
  });
});

// 2. META (Stub necesario para Nuvio)
router.get('/meta/:type/:id.json', ({ params }) => {
  return json({
    meta: {
      id: params.id.replace(".json", ""),
      type: params.type,
      name: "Metadata Placeholder",
    }
  });
});

// 3. STREAM (Lógica Real)
router.get('/stream/:type/:id.json', async (request, env) => {
  let { type, id } = request.params;
  
  // Limpieza del ID (importante para series tt123:1:1)
  id = decodeURIComponent(id).replace(".json", "");

  // Verificar Variable de Entorno
  if (!env.STREMIO_SERVER_URL) {
    return json({ 
      streams: [{ 
        name: "⚠️ ERROR", 
        title: "Falta configurar STREMIO_SERVER_URL en Cloudflare", 
        url: "http://error" 
      }] 
    });
  }
  
  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  try {
    // Construir URL de Torrentio
    const targetUrl = `${TORRENTIO_BASE}/stream/${type}/${id}.json`;
    console.log(`Fetching: ${targetUrl}`);

    // Fetch a Torrentio con Headers de Navegador (Anti-bloqueo)
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return json({ 
        streams: [{ name: "⚠️ ERROR", title: `Torrentio respondió error: ${response.status}`, url: "http://error" }] 
      });
    }

    const data = await response.json();

    // Si no hay resultados
    if (!data.streams || data.streams.length === 0) {
      return json({ 
        streams: [{ name: "⚠️ VACÍO", title: "No se encontraron torrents para este contenido", url: "http://error" }] 
      });
    }

    // PROCESAMIENTO DE STREAMS
    const newStreams = data.streams.map(stream => {
      // Filtro básico: debe tener infoHash
      if (!stream.infoHash) return null;

      // Lógica de índice (0 para pelis, específico para series)
      const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
      
      // CONSTRUCCIÓN DEL ENLACE DEBRID/PROXY
      const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;

      // Formateo del título para que se vea bien en Nuvio
      // Limpiamos saltos de línea excesivos
      const parts = (stream.title || "").split("\n");
      const cleanTitle = parts[0]; 
      const details = parts[1] || `S:${stream.seeders || '?'} Size:${stream.behaviorHints?.filename || '?'}`;

      return {
        name: "⚡ HTTP", // Nombre corto en la etiqueta
        title: `${cleanTitle}\n${details}`, // Descripción
        url: directUrl,
        behaviorHints: {
          notWebReady: false, // Forzar compatibilidad web/iOS
          bingeGroup: stream.behaviorHints?.bingeGroup,
          filename: stream.behaviorHints?.filename
        }
      };
    }).filter(Boolean);

    return json({ streams: newStreams });

  } catch (error) {
    // Si algo explota, lo mostramos en la app
    return json({ 
      streams: [{ 
        name: "☠️ CRASH", 
        title: `Error del Worker: ${error.message}`, 
        url: "http://error" 
      }] 
    });
  }
});

router.options('*', () => new Response(null, { headers: corsHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: corsHeaders }));

export default { fetch: router.handle };