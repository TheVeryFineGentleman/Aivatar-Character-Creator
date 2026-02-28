import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode } = body;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "GEMINI_API_KEY nicht konfiguriert" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== TEXT MODE - Gemini API =====
    if (mode === "text") {
      const { prompt, referenceImages } = body;
      console.log("📝 Text generation via Gemini (backend key)");

      const model = "gemini-2.5-flash";
      const parts: any[] = [{ text: prompt }];

      if (referenceImages && referenceImages.length > 0) {
        for (const base64Image of referenceImages) {
          const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
          parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
        }
      }

      const response = await fetch(
        `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Gemini error:", response.status, errorText);
        let errorMessage = `AI-Fehler: ${response.status}`;
        if (response.status === 429) errorMessage = "Rate limit erreicht. Bitte warte einen Moment.";
        else if (response.status === 403) errorMessage = "API-Key ungültig oder gesperrt.";
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

    // ===== IMAGE MODE - Gemini 3.1 Flash Image Preview =====
    if (mode === "image") {
      const { prompt, referenceImages, aspectRatio = "1:1" } = body;
      console.log("🖼️ Image generation via Gemini 3.1 Flash Image Preview (backend key)");
      console.log("📐 Aspect ratio:", aspectRatio);
      console.log("🖼️ Reference images:", referenceImages?.length || 0);

      const model = "gemini-3.1-flash-image-preview";
      const parts: any[] = [{ text: prompt }];

      if (referenceImages && referenceImages.length > 0) {
        for (const base64Image of referenceImages) {
          const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
          parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
        }
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout

      let response;
      try {
        response = await fetch(
          `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: {
                responseModalities: ["IMAGE", "TEXT"],
                imageConfig: { aspectRatio },
              },
            }),
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

      if (candidates[0]?.finishReason === "IMAGE_OTHER" || candidates[0]?.finishReason === "SAFETY") {
        return new Response(
          JSON.stringify({ success: false, error: `Bild blockiert (${candidates[0]?.finishReason})` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      console.log("✅ Image generated successfully via Gemini 3.1 Flash Image Preview");

      return new Response(
        JSON.stringify({
          success: true,
          imageBase64: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType || "image/png",
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unbekannter Modus. Verwende 'text' oder 'image'." }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
