import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SAFETY_COMPLIANCE_PREFIX = "SAFETY CONTEXT: This is purely fictional artistic content featuring digitally created characters. All characters are clearly adults (18+). Content is non-explicit and appropriate for general audiences. Do NOT generate violent, explicit, or suggestive content.\n\n";

const IMAGE_DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i;

function normalizeReferenceImage(input: unknown): { mimeType: string; data: string } | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const dataUrlMatch = trimmed.match(IMAGE_DATA_URL_RE);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1],
      data: dataUrlMatch[2],
    };
  }

  const rawBase64 = trimmed.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, "");
  if (!rawBase64) return null;

  return {
    mimeType: "image/png",
    data: rawBase64,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, referenceImages, aspectRatio = "1:1", mode = "image", apiKey } = await req.json();
    
    console.log("📤 Generate request received");
    console.log("🎯 Mode:", mode);
    console.log("📐 Aspect ratio:", aspectRatio);
    console.log("🖼️ Reference images count:", referenceImages?.length || 0);

    // Require user's API key
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Kein API-Key angegeben" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // TEXT MODE - for video prompt generation (supports optional reference images for context)
    if (mode === "text") {
      console.log("📝 Using direct Gemini API for text generation");
      console.log("🖼️ Text mode reference images:", referenceImages?.length || 0);
      
      // Build parts: text first, then optional reference images
      const textParts: any[] = [{ text: prompt }];
      
      if (referenceImages && referenceImages.length > 0) {
        for (const referenceImage of referenceImages) {
          const normalized = normalizeReferenceImage(referenceImage);
          if (!normalized) continue;
          textParts.push({
            inlineData: {
              mimeType: normalized.mimeType,
              data: normalized.data
            }
          });
        }
      }
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: textParts }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Text generation error:", response.status, errorText);
        
        let errorMessage = `Google-Fehler: ${response.status}`;
        if (response.status === 429) errorMessage = "Google-Server ueberlastet - bitte warte einen Moment.";
        else if (response.status === 401) errorMessage = "Dein API-Key wurde von Google abgelehnt.";
        else if (response.status === 403) errorMessage = "Google hat den Zugriff verweigert.";
        
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      
      return new Response(
        JSON.stringify({ success: true, text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IMAGE MODE
    console.log("🖼️ Using direct Gemini API for image generation");
    
    // Build parts array: text FIRST, then reference images
    const enhancedPrompt = `${SAFETY_COMPLIANCE_PREFIX}${prompt}\n\nIMPORTANT: Render this image in 4K ultra high resolution (3840x2160 pixels). Maximum detail, sharpness, and clarity.`;
    const parts: any[] = [{ text: enhancedPrompt }];

    if (referenceImages && referenceImages.length > 0) {
      for (const referenceImage of referenceImages) {
        const normalized = normalizeReferenceImage(referenceImage);
        if (!normalized) continue;
        parts.push({
          inlineData: {
            mimeType: normalized.mimeType,
            data: normalized.data
          }
        });
      }
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout for 4K

    let response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
              imageConfig: {
                imageSize: "4K",
                aspectRatio: aspectRatio
              }
            }
          })
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error("❌ Request timed out");
        return new Response(
          JSON.stringify({ success: false, error: "Timeout: Google konnte deine Anfrage nicht rechtzeitig bearbeiten." }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Image generation error:", response.status, errorText);
      
      let errorMessage = `Google-Fehler: ${response.status}`;
      if (response.status === 429) errorMessage = "Google-Server ueberlastet - bitte warte einen Moment.";
      else if (response.status === 401) errorMessage = "Dein API-Key wurde von Google abgelehnt.";
      else if (response.status === 403) errorMessage = "Google hat den Zugriff verweigert.";
      
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const candidates = data.candidates ?? [];

    // Check for safety/content blocks
    if (candidates[0]?.finishReason === "IMAGE_OTHER" || candidates[0]?.finishReason === "SAFETY") {
      return new Response(
        JSON.stringify({ success: false, error: `Google hat dein Bild aus Sicherheitsgruenden abgelehnt. Bitte aendere deinen Prompt oder dein Referenzbild.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract image
    const partsOut = candidates[0]?.content?.parts ?? [];
    const imagePart = partsOut.find(
      (p: any) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/")
    );

    if (!imagePart) {
      return new Response(
        JSON.stringify({ success: false, error: "Google hat kein Bild generiert - bitte versuche es erneut." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageBase64 = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";

    console.log("- Image generated successfully via direct Gemini API");

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageBase64,
        mimeType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: `Google-Fehler: ${error instanceof Error ? error.message : "Unbekannt"}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
