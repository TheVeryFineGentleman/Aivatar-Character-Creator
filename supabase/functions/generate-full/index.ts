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

async function pollForResult(taskId: string, apiKey: string, endpoint: string, maxWaitMs = 55000): Promise<{ success: boolean; resultUrls?: string[]; error?: string }> {
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const statusResponse = await fetch(
      `${KIE_API_BASE}${endpoint}?taskId=${taskId}`,
      {
        method: "GET",
        headers: { "Authorization": `Bearer ${apiKey}` },
      }
    );

    if (!statusResponse.ok) {
      const errText = await statusResponse.text();
      console.error("❌ Status check failed:", statusResponse.status, errText);
      continue;
    }

    const statusData = await statusResponse.json();
    const data = statusData.data;

    // Check for completion
    const resultUrls = data?.response?.resultUrls
      || data?.resultUrls
      || data?.works?.map((w: any) => w.resource?.resource)
      || [];

    if (data?.successFlag === 1 && resultUrls.length > 0) {
      return { success: true, resultUrls };
    }

    if (data?.errorCode || data?.errorMessage) {
      return { success: false, error: data?.errorMessage || `Error code: ${data?.errorCode}` };
    }
  }

  return { success: false, error: "Zeitüberschreitung bei der Bildgenerierung" };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mode, prompt, referenceImages, aspectRatio = "1:1" } = await req.json();

    // ===== TEXT MODE - Gemini API with backend key =====
    if (mode === "text") {
      console.log("📝 Text generation via Gemini (backend key)");

      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: "GEMINI_API_KEY nicht konfiguriert" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const model = "gemini-2.5-flash";

      // Build parts array for Gemini
      const parts: any[] = [{ text: prompt }];

      if (referenceImages && referenceImages.length > 0) {
        for (const base64Image of referenceImages) {
          const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
          parts.push({
            inlineData: { mimeType: "image/png", data: cleanBase64 }
          });
        }
      }

      const response = await fetch(
        `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
            },
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

    // ===== IMAGE MODE - kie.ai Flux Kontext =====
    if (mode === "image") {
      console.log("🖼️ Image generation via kie.ai Flux Kontext");

      const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
      if (!KIE_API_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: "KIE_API_KEY nicht konfiguriert" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check required env vars for DO Spaces
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

      // Upload first reference image to DO Spaces for kie.ai
      if (referenceImages && referenceImages.length > 0) {
        console.log("📤 Uploading reference image to DO Spaces...");
        const result = await uploadToSpaces(referenceImages[0], `ref-${Date.now()}.png`);
        inputImageUrl = result.url;
        spacesKeys.push(result.key);
        console.log("✅ Reference image uploaded:", inputImageUrl);
      }

      // Call kie.ai Flux Kontext generate API
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

      console.log("⏳ Polling for result, taskId:", taskId);

      // Poll for result (block until done or timeout)
      const result = await pollForResult(taskId, KIE_API_KEY, "/api/v1/flux/kontext/record-info");

      // Cleanup uploaded images
      await deleteFromSpaces(spacesKeys);

      if (!result.success) {
        return new Response(
          JSON.stringify({ success: false, error: result.error || "Bildgenerierung fehlgeschlagen" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imageUrl = result.resultUrls![0];
      console.log("✅ Image generated:", imageUrl);

      return new Response(
        JSON.stringify({ success: true, imageUrl }),
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
