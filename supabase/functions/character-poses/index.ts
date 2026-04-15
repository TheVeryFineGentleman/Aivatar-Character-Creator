import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const POSE_LIBRARY = [
  "standing straight with arms at sides, relaxed neutral pose",
  "sitting on a chair, legs crossed, looking at camera",
  "walking forward mid-stride, natural movement",
  "leaning against a wall casually, arms crossed",
  "sitting cross-legged on the ground",
  "running in dynamic motion, energetic",
  "jumping with arms raised, joyful expression",
  "kneeling on one knee",
  "arms raised above head stretching",
  "pointing forward with right hand",
  "hands on hips, confident power pose",
  "waving hello with right hand",
  "reading a book while standing",
  "dancing with dynamic body movement",
  "crouching low, looking up",
  "standing with hands in pockets, casual",
  "sitting on ground with legs extended",
  "looking over shoulder, turning body halfway",
  "stretching arms wide open",
  "standing on tiptoes reaching up",
  "bowing slightly forward",
  "holding something with both hands in front",
  "standing with one foot forward, dramatic pose",
  "leaning forward curiously",
  "standing back-to-camera looking over shoulder",
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { referenceImage, poseIndex, outfit, location, background, apiKey } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Kein API-Key angegeben" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!referenceImage) {
      return new Response(
        JSON.stringify({ success: false, error: "Referenzbild erforderlich" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pose = POSE_LIBRARY[poseIndex % POSE_LIBRARY.length];

    let bgInstruction = "Pure white seamless studio background (#FFFFFF).";
    if (background === "location" && location) {
      bgInstruction = `Background: ${location} environment, natural and detailed.`;
    } else if (background === "custom") {
      bgInstruction = "Use a custom colored background as specified.";
    }

    let outfitInstruction = "";
    if (outfit && outfit.trim()) {
      outfitInstruction = `\nOUTFIT: The character is wearing ${outfit}.`;
    }

    let locationInstruction = "";
    if (location && location.trim() && background === "location") {
      locationInstruction = `\nSETTING: The scene takes place in/at ${location}.`;
    }

    const prompt = `SAFETY CONTEXT: This is purely fictional artistic content featuring digitally created characters. All characters are clearly adults (18+). Content is non-explicit and appropriate for general audiences. Do NOT generate violent, explicit, or suggestive content.\n\nFull body portrait of the EXACT same character from the reference image. Reproduce their face, hair, skin tone, and all physical features precisely.\n\nPOSE: ${pose}${outfitInstruction}${locationInstruction}\nBACKGROUND: ${bgInstruction}\n\nCRITICAL: Same character identity as reference. Professional lighting, high quality. Full body visible head to toe. This is a fictional digital character for an art project.`;

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
              imageConfig: { aspectRatio: "1:1" }
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
