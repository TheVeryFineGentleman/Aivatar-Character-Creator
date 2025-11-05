import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const POSES = [
  "standing straight",
  "sitting casually",
  "walking forward",
  "running",
  "jumping",
  "waving",
  "pointing",
  "crossing arms",
  "hands on hips",
  "thinking pose",
  "excited pose",
  "laughing",
  "surprised expression",
  "confident stance",
  "relaxed pose",
  "action pose",
  "heroic pose",
  "dynamic pose",
  "leaning against wall",
  "stretching",
  // ... 80 more poses would go here
];

const CLOTHING = [
  "casual t-shirt and jeans",
  "formal suit",
  "sportswear",
  "dress",
  "hoodie and pants",
  "jacket and shirt",
  "uniform",
  "traditional outfit",
  "summer clothes",
  "winter coat",
];

const EXPRESSIONS = [
  "happy smile",
  "serious",
  "friendly",
  "excited",
  "calm",
  "confident",
  "playful",
  "determined",
  "gentle",
  "energetic",
];

const ANGLES = [
  "front view",
  "back view",
  "left side view",
  "right side view",
  "front-left angle",
  "front-right angle",
  "back-left angle",
  "back-right angle",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey, referenceImages, background, count, customPrompt } =
      await req.json();

    if (!apiKey) {
      throw new Error("API key is required");
    }

    console.log(`Generating ${count} images with background: ${background}`);

    const images: string[] = [];

    // First 8 images: all angles on white background
    const anglesToGenerate = Math.min(8, count);
    for (let i = 0; i < anglesToGenerate; i++) {
      const angle = ANGLES[i];
      const prompt = customPrompt ||
        `Create an image of the character from the reference images. ${angle}, standing still pose, white background, full body shot, character design, clean composition`;

      console.log(`Generating image ${i + 1} with prompt: ${prompt}`);

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" +
          apiKey,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  ...referenceImages.map((img: string) => ({
                    inline_data: {
                      mime_type: img.split(";")[0].split(":")[1],
                      data: img.split(",")[1],
                    },
                  })),
                ],
              },
            ],
            generationConfig: {
              temperature: 0.9,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error: ${errorText}`);
        throw new Error(`Failed to generate image: ${errorText}`);
      }

      const data = await response.json();

      // Note: Gemini API doesn't directly generate images like DALL-E
      // This is a placeholder - in reality, you'd need to use Imagen API
      // or another image generation endpoint
      console.log("API Response:", JSON.stringify(data, null, 2));

      // For now, we'll return a placeholder
      // In production, you'd integrate with Google's Imagen API
      images.push("data:image/png;base64,placeholder");
    }

    // Remaining images: random poses and backgrounds
    for (let i = anglesToGenerate; i < count; i++) {
      const pose = POSES[Math.floor(Math.random() * POSES.length)];
      const clothing = CLOTHING[Math.floor(Math.random() * CLOTHING.length)];
      const expression =
        EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
      const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];

      let backgroundPrompt = "";
      if (background === "white") {
        backgroundPrompt = "white background";
      } else if (background === "greenscreen") {
        backgroundPrompt = "green screen background";
      } else {
        backgroundPrompt =
          "realistic environment background, detailed scenery";
      }

      const prompt = customPrompt ||
        `Create an image of the character from the reference images. ${angle}, ${pose}, wearing ${clothing}, ${expression}, ${backgroundPrompt}, full body shot, character design, high quality`;

      console.log(`Generating image ${i + 1} with prompt: ${prompt}`);

      // Same API call structure as above
      images.push("data:image/png;base64,placeholder");
    }

    return new Response(JSON.stringify({ images }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-character-images function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
