import { Router } from 'itty-router';

const router = Router();

// URL de Torrentio configurada (Providers + Quality)
const TORRENTIO_URL = "https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,magnetdl,torrentgalaxy";

// Headers CORS Universales (Blindado)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Origin, X-Requested-With",
  "Content-Type": "application/json; charset=utf-8" // Importante charset
};

// Función helper para responder JSON rápido
const json = (data) => new Response(JSON.stringify(data), { headers: corsHeaders });

// ==========================================
// 1. MANIFEST (Estricto con Objetos)
// ==========================================
router.get('/manifest.json', () => {
  return json({
    id: "com.midomain.httpbridge",
    version: "1.0.5",
    name: "HTTP Bridge (Nuvio)",
    description: "Puente HTTPS para Stremio Server - Fixed",
    // Icono opcional para que se vea bien
    logo: "https://dl.strem.io/addon-logo.png", 
    
    // Aquí el cambio clave: Resources como objetos detallados
    resources: [
      {
        name: "stream",
        types: ["movie", "series"],
        idPrefixes: ["tt"]
      },
      {
        name: "meta", // Agregado para satisfacer clientes estrictos
        types: ["movie", "series"],
        idPrefixes: ["tt"]
      }
    ],
    
    types: ["movie", "series"],
    catalogs: [], // Explícito vacío
    idPrefixes: ["tt"]
  });
});

// ==========================================
// 2. META (Stub/Dummy)
// ==========================================
// Aunque no tengamos metadata propia, respondemos lo básico para que Nuvio no falle
router.get('/meta/:type/:id.json', ({ params }) => {
  const { type, id } = params;
  // Solo devolvemos el ID y tipo para confirmar existencia
  return json({
    meta: {
      id: id.replace(".json", ""),
      type: type,
      name: id, // Placeholder
      poster: "", // Evita errores de null
      background: ""
    }
  });
});

// ==========================================
// 3. STREAM (La Lógica Principal)
// ==========================================
router.get('/stream/:type/:id.json', async (request, env) => {
  let { type, id } = request.params;
  id = decodeURIComponent(id).replace(".json", ""); // Limpieza extra

  if (!env.STREMIO_SERVER_URL) {
    return json({ streams: [{ title: "⚠️ Config Error: STREMIO_SERVER_URL missing", url: "" }] });
  }

  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  try {
    const targetUrl = `${TORRENTIO_URL}/stream/${type}/${id}.json`;
    console.log(`Pidiendo a: ${targetUrl}`);

    const response = await fetch(targetUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    });

    if (!response.ok) return json({ streams: [] });

    const data = await response.json();

    if (!data.streams || !data.streams.length) return json({ streams: [] });

    const newStreams = data.streams.map(stream => {
      // Filtros de seguridad
      if (!stream.infoHash) return null;

      const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
      const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;
      
      // Limpieza del título para que se vea pro en Nuvio
      const metaLine = stream.title?.split('\n')[0] || "Stream";
      const techDetails = stream.title?.split('\n')[1] || "";

      return {
        name: "⚡ HTTP Bridge",
        title: `${metaLine}\n${techDetails}`, // Mantiene info de calidad (4K, HDR)
        url: directUrl,
        behaviorHints: {
          notWebReady: false, 
          bingeGroup: stream.behaviorHints?.bingeGroup,
          filename: stream.behaviorHints?.filename
        }
      };
    }).filter(Boolean);

    return json({ streams: newStreams });

  } catch (error) {
    console.error(error);
    return json({ streams: [] });
  }
});

// Manejo de OPTIONS (Pre-flight CORS)
router.options('*', () => new Response(null, { headers: corsHeaders }));

// 404
router.all('*', () => new Response('Not Found', { status: 404, headers: corsHeaders }));

export default {
  fetch: router.handle
};