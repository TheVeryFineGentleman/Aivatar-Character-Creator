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
      front: "CAMERA POSITION: Directly in front of the character at eye level, centered. WHAT IS VISIBLE: The entire face is fully visible — both eyes looking straight into the camera, nose centered, both ears partially visible, mouth and chin symmetrical. The shoulders are squared and even. Hair falls naturally as seen from the front. This is a perfectly symmetrical, straight-on frontal portrait with direct eye contact.",
      back: "CAMERA POSITION: Directly behind the character at eye level, centered on the back of the head. WHAT IS VISIBLE: The back of the skull, the full hairstyle from behind showing hair length, texture and how it falls on the neck and shoulders. Both ears may be partially visible on the sides. The neck, upper back and shoulders are visible. NO part of the face is visible — no eyes, no nose, no mouth, no cheeks. The character is facing AWAY from the camera completely.",
      right: "CAMERA POSITION: Exactly 90 degrees to the right side of the character at eye level, a perfect side profile. WHAT IS VISIBLE: Only the right side of the face in strict profile — one eye visible from the side, the nose protruding in silhouette, lips in profile, the jawline, one ear fully visible. The left side of the face is completely hidden behind the head. Hair is visible as it drapes on the right side. This is a textbook 90-degree right profile shot.",
      left: "CAMERA POSITION: Exactly 90 degrees to the left side of the character at eye level, a perfect side profile. WHAT IS VISIBLE: Only the left side of the face in strict profile — one eye visible from the side, the nose protruding in silhouette, lips in profile, the jawline, one ear fully visible. The right side of the face is completely hidden behind the head. Hair is visible as it drapes on the left side. This is a textbook 90-degree left profile shot.",
      "front-above": "CAMERA POSITION: Above and in front of the character, angled approximately 30-40 degrees downward, like looking down at someone from a slightly elevated position. WHAT IS VISIBLE: The top of the head and hair are prominently visible, the forehead appears larger due to the angle, both eyes are looking upward toward the camera, the nose is foreshortened. The shoulders appear below. This is a high-angle three-quarter view from the front.",
      "back-above": "CAMERA POSITION: Above and behind the character, angled approximately 30-40 degrees downward from behind, like looking down at the back of someone's head from an elevated rear position. WHAT IS VISIBLE: The top and back of the head dominate the frame, the crown of the hair, the back of the neck. A sliver of the cheek or ear might be visible at the edge. The shoulders and upper back are visible below. NO direct facial features are shown. This is a high-angle three-quarter view from behind.",
    };

    const stylePrompts: Record<string, string> = {
      realistic: "photorealistic, natural lighting, detailed skin texture, 85mm f/1.4 lens, professional photography",
      anime: "anime style, cel-shaded, vibrant colors, Japanese animation aesthetic",
      comic: "comic book style, bold outlines, dynamic composition",
      pixar: "3D rendered, Pixar-quality, stylized, volumetric lighting",
    };

    const anglePrompt = anglePrompts[angle] || anglePrompts.front;
    const stylePrompt = stylePrompts[style] || stylePrompts.realistic;

    const prompt = `SAFETY CONTEXT: This is purely fictional artistic content featuring digitally created characters. All characters are clearly adults (18+). Content is non-explicit and appropriate for general audiences. Do NOT generate violent, explicit, or suggestive content.\n\n${anglePrompt}\n\nART STYLE: ${stylePrompt}\n\nCRITICAL RULES:\n- Reproduce the EXACT same character from the reference image: same face, hair color, hairstyle, skin tone, facial features, eye color.\n- MANDATORY BACKGROUND: Pure white seamless studio background (#FFFFFF). No gradients, no textures, no environment.\n- Professional studio lighting, soft and even.\n- Show only the character, no props, no other people.\n- This is a fictional digital character illustration for an art project.`;

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
          JSON.stringify({ success: false, error: "Timeout: Google konnte deine Anfrage nicht rechtzeitig bearbeiten." }),
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
      if (response.status === 429) errorMessage = "Rate limit erreicht – dein API-Key hat das kostenlose Kontingent ausgeschöpft. Bitte warte 1–2 Minuten oder aktiviere Billing unter aistudio.google.com.";
      else if (response.status === 401) errorMessage = "API-Key ungültig oder abgelaufen – bitte prüfe deinen Key in den Einstellungen (aistudio.google.com → API Keys).";
      else if (response.status === 403) errorMessage = "Zugriff verweigert – bitte stelle sicher, dass Billing in deinem Google-Konto aktiviert ist (aistudio.google.com).";
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const candidates = data.candidates ?? [];

    if (candidates[0]?.finishReason === "IMAGE_OTHER" || candidates[0]?.finishReason === "SAFETY") {
      return new Response(
        JSON.stringify({ success: false, error: `Google hat dein Bild aus Sicherheitsgruenden abgelehnt. Bitte aendere deinen Prompt oder dein Referenzbild.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const partsOut = candidates[0]?.content?.parts ?? [];
    const imagePart = partsOut.find((p: any) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/"));

    if (!imagePart) {
      return new Response(
        JSON.stringify({ success: false, error: "Google hat kein Bild generiert - bitte versuche es erneut." }),
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
      JSON.stringify({ success: false, error: `Google-Fehler: ${error instanceof Error ? error.message : "Unbekannt"}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
