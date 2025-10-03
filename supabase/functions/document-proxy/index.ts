/*
  # Document Proxy Function

  1. Purpose
    - Proxy external document requests to bypass CORS restrictions
    - Enable document viewing and analysis from external URLs
    - Support PDF, image, and other document formats

  2. Security
    - Enable RLS (handled by Supabase automatically)
    - Validate URLs to prevent abuse
    - Set appropriate CORS headers
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ProxyRequest {
  url: string;
  method?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { url, method = 'GET' }: ProxyRequest = await req.json();
    
    // Validation de l'URL
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL manquante ou invalide' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Vérifier que c'est une URL valide
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Format d\'URL invalide' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Sécurité: autoriser seulement HTTP/HTTPS
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return new Response(
        JSON.stringify({ error: 'Protocole non autorisé' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('📥 Proxy request pour:', url);

    // Effectuer la requête vers l'URL cible
    const response = await fetch(url, {
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DocumentProxy/1.0)',
        'Accept': '*/*',
      },
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: `Erreur ${response.status}: ${response.statusText}` 
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Récupérer le contenu
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    console.log('✅ Document récupéré:', {
      size: Math.round(arrayBuffer.byteLength / 1024) + 'KB',
      contentType
    });

    // Retourner le document avec les bons headers
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache 1h
      }
    });

  } catch (error) {
    console.error('❌ Erreur proxy:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur interne du proxy' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});