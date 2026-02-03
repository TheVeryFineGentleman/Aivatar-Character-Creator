import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    
    // TEXT MODE - for video prompt generation
    if (mode === "text") {
      console.log("📝 Using direct Gemini API for text generation");
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Text generation error:", response.status, errorText);
        
        let errorMessage = `API error: ${response.status}`;
        if (response.status === 429) errorMessage = "Rate limit erreicht. Bitte warte einen Moment.";
        else if (response.status === 401) errorMessage = "API-Key ungültig oder abgelaufen";
        else if (response.status === 403) errorMessage = "Zugriff verweigert";
        
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
    const parts: any[] = [{ text: prompt }];

    if (referenceImages && referenceImages.length > 0) {
      for (const base64Image of referenceImages) {
        const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: cleanBase64
          }
        });
      }
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout

    let response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"]
            }
          })
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error("❌ Request timed out");
        return new Response(
          JSON.stringify({ success: false, error: "Zeitüberschreitung - bitte erneut versuchen" }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Image generation error:", response.status, errorText);
      
      let errorMessage = `API error: ${response.status}`;
      if (response.status === 429) errorMessage = "Rate limit erreicht. Bitte warte einen Moment.";
      else if (response.status === 401) errorMessage = "API-Key ungültig oder abgelaufen";
      else if (response.status === 403) errorMessage = "Zugriff verweigert";
      
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
        JSON.stringify({ success: false, error: `Bild blockiert (${candidates[0]?.finishReason})` }),
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
        JSON.stringify({ success: false, error: "Kein Bild generiert" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageBase64 = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";

    console.log("✅ Image generated successfully via direct Gemini API");

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
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
