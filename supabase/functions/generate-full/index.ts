import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KIE_API_BASE = "https://api.kie.ai";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getS3Client(bucket: string) {
  return new S3Client({
    endPoint: "fra1.digitaloceanspaces.com",
    region: "fra1",
    bucket,
    accessKey: Deno.env.get("DO_SPACES_ACCESS_KEY")!,
    secretKey: Deno.env.get("DO_SPACES_SECRET_KEY")!,
    pathStyle: false,
  });
}

async function uploadToSpaces(base64Data: string, fileName: string): Promise<{ url: string; key: string }> {
  const bucket = Deno.env.get("DO_SPACES_BUCKET")!;
  const s3 = getS3Client(bucket);

  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const binaryData = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));

  const key = `temp-images/${fileName}`;

  await s3.putObject(key, binaryData, {
    metadata: { "Content-Type": "image/png", "x-amz-acl": "public-read" },
  });

  const url = `https://${bucket}.fra1.digitaloceanspaces.com/${key}`;
  return { url, key };
}

async function deleteFromSpaces(keys: string[]) {
  const bucket = Deno.env.get("DO_SPACES_BUCKET")!;
  const s3 = getS3Client(bucket);
  for (const key of keys) {
    try {
      await s3.deleteObject(key);
    } catch (err) {
      console.warn(`⚠️ Failed to delete ${key}:`, err);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode } = body;

    // ===== TEXT MODE - Gemini API =====
    if (mode === "text") {
      const { prompt, referenceImages } = body;
      console.log("📝 Text generation via Gemini (backend key)");

      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: "GEMINI_API_KEY nicht konfiguriert" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

    // ===== IMAGE-START MODE - Start kie.ai job, return taskId immediately =====
    if (mode === "image-start") {
      const { prompt, referenceImages, aspectRatio = "1:1" } = body;
      console.log("🖼️ Image generation START via kie.ai Flux Kontext");

      const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
      if (!KIE_API_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: "KIE_API_KEY nicht konfiguriert" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const requiredEnv = ["DO_SPACES_ACCESS_KEY", "DO_SPACES_SECRET_KEY", "DO_SPACES_BUCKET"];
      for (const env of requiredEnv) {
        if (!Deno.env.get(env)) {
          return new Response(
            JSON.stringify({ success: false, error: `${env} nicht konfiguriert` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      let inputImageUrl: string | undefined;
      const spacesKeys: string[] = [];

      if (referenceImages && referenceImages.length > 0) {
        console.log("📤 Uploading reference image to DO Spaces...");
        const result = await uploadToSpaces(referenceImages[0], `ref-${Date.now()}.png`);
        inputImageUrl = result.url;
        spacesKeys.push(result.key);
        console.log("✅ Reference image uploaded:", inputImageUrl);
      }

      const generateBody: any = {
        prompt,
        aspectRatio,
        model: "flux-kontext-pro",
        outputFormat: "png",
      };
      if (inputImageUrl) {
        generateBody.inputImage = inputImageUrl;
      }

      console.log("🚀 Starting Flux Kontext image generation");
      const generateResponse = await fetch(`${KIE_API_BASE}/api/v1/flux/kontext/generate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(generateBody),
      });

      if (!generateResponse.ok) {
        const errText = await generateResponse.text();
        console.error("❌ Image generation failed:", generateResponse.status, errText);
        await deleteFromSpaces(spacesKeys);
        let errorMessage = `Bildgenerierung fehlgeschlagen: ${generateResponse.status}`;
        if (generateResponse.status === 429) errorMessage = "Rate limit erreicht. Bitte warte einen Moment.";
        else if (generateResponse.status === 401) errorMessage = "API-Key ungültig";
        else if (generateResponse.status === 402) errorMessage = "Nicht genügend kie.ai Credits";
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: generateResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const generateData = await generateResponse.json();
      const taskId = generateData.data?.taskId;

      if (!taskId) {
        console.error("❌ No taskId:", generateData);
        await deleteFromSpaces(spacesKeys);
        return new Response(
          JSON.stringify({ success: false, error: "Keine Task-ID erhalten" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log("✅ Job started, taskId:", taskId, "spacesKeys:", spacesKeys);

      // Return immediately with taskId - client will poll
      return new Response(
        JSON.stringify({ success: true, taskId, spacesKeys }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== IMAGE-STATUS MODE - Check kie.ai task status =====
    if (mode === "image-status") {
      const { taskId, spacesKeys } = body;

      const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
      if (!KIE_API_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: "KIE_API_KEY nicht konfiguriert" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusResponse = await fetch(
        `${KIE_API_BASE}/api/v1/flux/kontext/record-info?taskId=${taskId}`,
        {
          method: "GET",
          headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
        }
      );

      if (!statusResponse.ok) {
        const errText = await statusResponse.text();
        console.error("❌ Status check failed:", statusResponse.status, errText);
        return new Response(
          JSON.stringify({ success: true, status: "processing" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusData = await statusResponse.json();
      console.log("📊 Status response:", JSON.stringify(statusData).slice(0, 500));
      const data = statusData.data;

      const resultUrls = data?.response?.resultUrls
        || data?.resultUrls
        || data?.works?.map((w: any) => w.resource?.resource)
        || [];
      
      // Also check for single resultImageUrl (newer API format)
      const singleResultUrl = data?.response?.resultImageUrl;

      if (data?.successFlag === 1 && (resultUrls.length > 0 || singleResultUrl)) {
        // Done! Cleanup temp images
        if (spacesKeys && spacesKeys.length > 0) {
          await deleteFromSpaces(spacesKeys);
        }
        const imageUrl = resultUrls[0] || singleResultUrl;
        console.log("✅ Image generated:", imageUrl);
        return new Response(
          JSON.stringify({ success: true, status: "completed", imageUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (data?.errorCode || data?.errorMessage) {
        if (spacesKeys && spacesKeys.length > 0) {
          await deleteFromSpaces(spacesKeys);
        }
        return new Response(
          JSON.stringify({ success: false, status: "failed", error: data?.errorMessage || `Error code: ${data?.errorCode}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Still processing
      return new Response(
        JSON.stringify({ success: true, status: "processing" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== LEGACY IMAGE MODE (kept for backward compatibility) =====
    if (mode === "image") {
      // Redirect to new start+poll flow from server side for backward compat
      // But this will likely timeout - recommend using image-start + image-status
      return new Response(
        JSON.stringify({ success: false, error: "Bitte aktualisiere die App. Der alte Image-Modus wird nicht mehr unterstützt." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unbekannter Modus. Verwende 'text', 'image-start' oder 'image-status'." }),
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
