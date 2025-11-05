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
    const { apiKey, referenceImages, background, count, customPrompt, isFirstEight, angle } = await req.json();
    
    if (!apiKey) {
      throw new Error("API key is required");
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
        prompt = `Generate an image of a character. ${viewAngle} view, standing still pose, white background, full body shot, clean composition`;
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
          bgText = "green screen background";
        } else {
          bgText = "detailed scenery background";
        }
        
        prompt = `Generate an image of a character. ${viewAngle} angle, ${pose}, wearing ${clothing}, ${expression}, ${bgText}, full body shot, high quality`;
      }
      
      console.log(`Generating image ${i + 1} with prompt: ${prompt}`);
      
      // Call Google Gemini API for image generation
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"]
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Google API error: ${response.status}`);
        console.error(`Error details: ${errorText}`);
        throw new Error(`Image generation failed: ${response.status} - ${errorText}`);
      }
      
      console.log(`✅ API Response received for image ${i + 1}`);

      const data = await response.json();
      console.log("=== FULL API Response ===");
      console.log(JSON.stringify(data, null, 2));
      console.log("=========================");
      
      // Extract the generated image from the response
      // Google Gemini API returns: { candidates: [{ content: { parts: [{ inlineData: { data: "base64" } }] } }] }
      if (data.candidates && data.candidates[0]?.content?.parts) {
        const imagePart = data.candidates[0].content.parts.find(
          (part: any) => part.inlineData
        );
        if (imagePart?.inlineData?.data) {
          const imageData = imagePart.inlineData.data;
          generatedImages.push(`data:image/png;base64,${imageData}`);
          console.log(`✅ Image ${i + 1} generated successfully`);
        } else {
          console.error("❌ No inlineData in parts. Full response:", data);
          throw new Error(`No image data in response parts`);
        }
      } else {
        console.error("❌ No candidates in response. Full response:", data);
        throw new Error(`No candidates in response. Structure: ${JSON.stringify(Object.keys(data))}`);
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
