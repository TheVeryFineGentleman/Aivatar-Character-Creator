import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POSES = [
  "standing straight", "sitting casually", "walking forward", "running", 
  "jumping", "waving", "pointing", "crossing arms", "thinking pose",
  "surprised expression", "laughing", "dynamic pose", "relaxed pose",
  "action pose", "excited pose"
];

const CLOTHING = [
  "casual t-shirt and jeans", "formal suit", "dress", "sportswear",
  "hoodie and pants", "jacket and shirt", "uniform", "traditional outfit",
  "winter coat", "summer clothes"
];

const EXPRESSIONS = [
  "happy smile", "serious", "friendly", "excited", "calm", "determined",
  "gentle", "energetic"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { referenceImages, background, count, customPrompt, isFirstEight, angle } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!referenceImages || referenceImages.length === 0) {
      throw new Error("At least one reference image is required");
    }

    const generatedImages: string[] = [];
    
    console.log(`Generating ${count} images with background: ${background}`);

    const angles = ["front", "front-right", "right", "back-right", "back", "back-left", "left", "front-left"];
    
    for (let i = 0; i < count; i++) {
      let prompt = "";
      
      if (customPrompt) {
        prompt = customPrompt;
      } else if (isFirstEight && i < 8) {
        // First 8 images: standing still from all angles
        const viewAngle = angle || angles[i];
        prompt = `Character from reference image, ${viewAngle} view, standing still, white background, full body, clean`;
      } else {
        // Random poses with variations
        const pose = POSES[Math.floor(Math.random() * POSES.length)];
        const clothing = CLOTHING[Math.floor(Math.random() * CLOTHING.length)];
        const expression = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
        const viewAngle = angles[Math.floor(Math.random() * angles.length)];
        
        let bgText = "";
        if (background === "white") {
          bgText = "white background";
        } else if (background === "greenscreen") {
          bgText = "green screen";
        } else {
          bgText = "detailed scenery";
        }
        
        prompt = `Character ${viewAngle}, ${pose}, ${clothing}, ${expression}, ${bgText}, full body`;
      }
      
      console.log(`Generating image ${i + 1} with prompt: ${prompt}`);
      
      // Call Lovable AI with image generation model
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          modalities: ["image", "text"]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI Gateway error: ${response.status} - ${errorText}`);
        
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        if (response.status === 402) {
          throw new Error("Payment required. Please add credits to your Lovable workspace.");
        }
        
        throw new Error(`Image generation failed: ${response.status}`);
      }

      const data = await response.json();
      console.log("API Response:", JSON.stringify(data));
      
      // Extract the generated image from the response
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageUrl) {
        generatedImages.push(imageUrl);
      } else {
        console.error("No image in response:", data);
        throw new Error("No image generated in response");
      }
    }

    return new Response(
      JSON.stringify({ images: generatedImages }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in generate-character-images function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An error occurred" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
