import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KIE_API_BASE = "https://api.kie.ai";

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
  
  const key = `temp-video-frames/${fileName}`;
  
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
      console.log(`🗑️ Deleted: ${key}`);
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

    const { action, taskId, startFrameBase64, endFrameBase64, prompt, model = "veo3_fast", uploadedKeys } = await req.json();

    // ACTION: cleanup - Delete temporary images from DO Spaces
    if (action === "cleanup") {
      if (!uploadedKeys || uploadedKeys.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "Nichts zu löschen" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`🗑️ Cleaning up ${uploadedKeys.length} temporary files`);
      await deleteFromSpaces(uploadedKeys);

      return new Response(
        JSON.stringify({ success: true, deleted: uploadedKeys.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: generate - Upload images to DO Spaces and start video generation
    if (action === "generate") {
      console.log("🎬 Video generation requested");

      if (!prompt) {
        return new Response(
          JSON.stringify({ success: false, error: "Kein Video-Prompt angegeben" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!startFrameBase64) {
        return new Response(
          JSON.stringify({ success: false, error: "Kein Start-Frame Bild angegeben" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imageUrls: string[] = [];
      const spacesKeys: string[] = [];

      // Upload start frame to DO Spaces
      console.log("📤 Uploading start frame to DO Spaces...");
      const startResult = await uploadToSpaces(startFrameBase64, `start-${Date.now()}.png`);
      imageUrls.push(startResult.url);
      spacesKeys.push(startResult.key);
      console.log("✅ Start frame uploaded:", startResult.url);

      // Upload end frame if provided
      if (endFrameBase64) {
        console.log("📤 Uploading end frame to DO Spaces...");
        try {
          const endResult = await uploadToSpaces(endFrameBase64, `end-${Date.now()}.png`);
          imageUrls.push(endResult.url);
          spacesKeys.push(endResult.key);
          console.log("✅ End frame uploaded:", endResult.url);
        } catch (err) {
          console.warn("⚠️ End frame upload failed, continuing without:", err);
        }
      }

      // Call kie.ai Veo3 generate API
      console.log("🚀 Starting Veo3 video generation with", imageUrls.length, "frames");
      const generateResponse = await fetch(`${KIE_API_BASE}/api/v1/veo/generate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, imageUrls, model }),
      });

      if (!generateResponse.ok) {
        const errText = await generateResponse.text();
        console.error("❌ Video generation failed:", generateResponse.status, errText);
        
        // Cleanup uploaded images on failure
        await deleteFromSpaces(spacesKeys);
        
        let errorMessage = `Video-Generierung fehlgeschlagen: ${generateResponse.status}`;
        if (generateResponse.status === 429) errorMessage = "Rate limit erreicht. Bitte warte einen Moment.";
        else if (generateResponse.status === 401) errorMessage = "API-Key ungültig oder abgelaufen";
        else if (generateResponse.status === 402) errorMessage = "Nicht genügend Credits bei kie.ai";
        
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: generateResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const generateData = await generateResponse.json();
      const generatedTaskId = generateData.data?.taskId;

      if (!generatedTaskId) {
        console.error("❌ No taskId in generate response:", generateData);
        await deleteFromSpaces(spacesKeys);
        return new Response(
          JSON.stringify({ success: false, error: "Keine Task-ID erhalten" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log("✅ Video generation started, taskId:", generatedTaskId);

      return new Response(
        JSON.stringify({ success: true, taskId: generatedTaskId, uploadedKeys: spacesKeys }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: status - Check video generation status
    if (action === "status") {
      if (!taskId) {
        return new Response(
          JSON.stringify({ success: false, error: "Keine Task-ID angegeben" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log("🔍 Checking status for task:", taskId);

      const statusResponse = await fetch(
        `${KIE_API_BASE}/api/v1/veo/record-info?taskId=${taskId}`,
        {
          method: "GET",
          headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
        }
      );

      if (!statusResponse.ok) {
        const errText = await statusResponse.text();
        console.error("❌ Status check failed:", statusResponse.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Status-Abfrage fehlgeschlagen: ${statusResponse.status}` }),
          { status: statusResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusData = await statusResponse.json();
      console.log("📦 Raw API response:", JSON.stringify(statusData));
      
      // Derive status from API response structure
      const resultUrls = statusData.data?.response?.resultUrls 
        || statusData.data?.resultUrls 
        || statusData.data?.works?.map((w: any) => w.resource?.resource) 
        || [];
      
      const successFlag = statusData.data?.successFlag;
      const errorCode = statusData.data?.errorCode;
      const errorMessage = statusData.data?.errorMessage;
      
      let taskStatus: string;
      if (successFlag === 1 && resultUrls.length > 0) {
        taskStatus = "completed";
      } else if (errorCode || errorMessage) {
        taskStatus = "failed";
      } else {
        taskStatus = "processing";
      }

      console.log("📊 Task status:", taskStatus, "successFlag:", successFlag, "Result URLs:", resultUrls.length);

      return new Response(
        JSON.stringify({
          success: true,
          status: taskStatus,
          resultUrls,
          rawData: statusData.data,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unbekannte Aktion" }),
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
