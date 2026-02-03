import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, referenceImages, aspectRatio = "1:1", mode = "image" } = await req.json();
    
    console.log("📤 Generate request received");
    console.log("🎯 Mode:", mode);
    console.log("📐 Aspect ratio:", aspectRatio);
    console.log("🖼️ Reference images count:", referenceImages?.length || 0);
    console.log("📝 Prompt length:", prompt?.length || 0);
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // For text-only mode (e.g., video prompt generation)
    if (mode === "text") {
      const textResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      if (!textResponse.ok) {
        const errorText = await textResponse.text();
        console.error("❌ Text generation error:", textResponse.status, errorText);
        throw new Error(`Text generation failed: ${textResponse.status}`);
      }

      const textData = await textResponse.json();
      const text = textData.choices?.[0]?.message?.content || "";
      
      return new Response(
        JSON.stringify({ success: true, text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IMAGE GENERATION MODE
    // Build the content for the request
    // Text prompt FIRST, then reference images
    const contentParts: any[] = [
      { type: "text", text: prompt }
    ];

    // Add reference images if provided
    if (referenceImages && referenceImages.length > 0) {
      for (const base64Image of referenceImages) {
        // Clean base64 (remove data URL prefix if present)
        const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${cleanBase64}`
          }
        });
      }
    }

    // Call Lovable AI Gateway with image generation model
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: contentParts
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Lovable AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Rate limit erreicht. Bitte warte einen Moment und versuche es erneut." 
          }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Credits aufgebraucht. Bitte lade deine Credits auf." 
          }),
          { 
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("📥 Lovable AI Gateway response received");

    // Extract the generated image from the response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("❌ No image in response:", JSON.stringify(data).substring(0, 500));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Kein Bild generiert. Das Bild wurde möglicherweise blockiert." 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log("✅ Image generated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: imageUrl 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("❌ Error in generate-image:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});