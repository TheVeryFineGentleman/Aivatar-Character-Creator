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
    const { referenceImage, angle, aspectRatio = "1:1", style = "realistic", apiKey } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Kein API-Key angegeben" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!referenceImage || !angle) {
      return new Response(
        JSON.stringify({ success: false, error: "Referenzbild und Winkel erforderlich" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anglePrompts: Record<string, string> = {
      front: "Front-facing portrait, looking directly at camera, neutral expression, straight-on eye contact. Same character from reference image.",
      back: "Back view portrait, showing the back of head, hair, neck and upper shoulders from behind. Same character from reference image.",
      right: "Right side profile portrait, showing the right side of the face in perfect 90-degree profile view. Same character from reference image.",
      left: "Left side profile portrait, showing the left side of the face in perfect 90-degree profile view. Same character from reference image.",
      "front-above": "Three-quarter view from slightly above and in front, camera angled 30 degrees downward, looking up at camera. Same character from reference image.",
      "back-above": "Three-quarter view from slightly above and behind, camera angled 30 degrees downward from behind, showing back of head and partial profile. Same character from reference image.",
    };

    const stylePrompts: Record<string, string> = {
      realistic: "photorealistic, natural lighting, detailed skin texture, 85mm f/1.4 lens, professional photography",
      anime: "anime style, cel-shaded, vibrant colors, Japanese animation aesthetic",
      comic: "comic book style, bold outlines, dynamic composition",
      pixar: "3D rendered, Pixar-quality, stylized, volumetric lighting",
    };

    const anglePrompt = anglePrompts[angle] || anglePrompts.front;
    const stylePrompt = stylePrompts[style] || stylePrompts.realistic;

    const prompt = `${anglePrompt}\n\nART STYLE: ${stylePrompt}\n\nCRITICAL RULES:\n- Reproduce the EXACT same character from the reference image: same face, hair color, hairstyle, skin tone, facial features, eye color.\n- MANDATORY BACKGROUND: Pure white seamless studio background (#FFFFFF). No gradients, no textures, no environment.\n- Professional studio lighting, soft and even.\n- Show only the character, no props, no other people.\n- This is a fictional digital character illustration for an art project.`;

    const cleanBase64 = referenceImage.replace(/^data:image\/[a-z]+;base64,/, '');

    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: "image/png", data: cleanBase64 } }
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

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
              imageConfig: { aspectRatio }
            }
          })
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ success: false, error: "Zeitüberschreitung" }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error:", response.status, errorText);
      let errorMessage = `API error: ${response.status}`;
      if (response.status === 429) errorMessage = "Rate limit erreicht. Bitte warte einen Moment.";
      else if (response.status === 401) errorMessage = "API-Key ungültig";
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
    const imagePart = partsOut.find((p: any) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/"));

    if (!imagePart) {
      return new Response(
        JSON.stringify({ success: false, error: "Kein Bild generiert" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, imageBase64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
