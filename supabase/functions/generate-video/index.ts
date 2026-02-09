import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KIE_API_BASE = "https://api.kie.ai";
const KIE_FILE_UPLOAD_BASE = "https://kieai.redpandaai.co";

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

    const { action, taskId, startFrameBase64, endFrameBase64, prompt, model = "veo3_fast" } = await req.json();

    // ACTION: generate - Upload images and start video generation
    if (action === "generate") {
      console.log("🎬 Video generation requested");
      console.log("📝 Prompt length:", prompt?.length || 0);
      console.log("🖼️ Start frame:", startFrameBase64 ? "provided" : "missing");
      console.log("🖼️ End frame:", endFrameBase64 ? "provided" : "missing");

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

      // Upload images to kie.ai file upload API
      const imageUrls: string[] = [];

      // Upload start frame
      console.log("📤 Uploading start frame...");
      const startUploadResponse = await fetch(`${KIE_FILE_UPLOAD_BASE}/api/file-base64-upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Data: startFrameBase64,
          fileName: `start-frame-${Date.now()}.png`,
        }),
      });

      if (!startUploadResponse.ok) {
        const errText = await startUploadResponse.text();
        console.error("❌ Start frame upload failed:", startUploadResponse.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Start-Frame Upload fehlgeschlagen: ${startUploadResponse.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const startUploadData = await startUploadResponse.json();
      const startFrameUrl = startUploadData.data?.downloadUrl || startUploadData.data?.fileUrl;
      if (!startFrameUrl) {
        console.error("❌ No download URL in start frame upload response:", startUploadData);
        return new Response(
          JSON.stringify({ success: false, error: "Keine URL für Start-Frame erhalten" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log("✅ Start frame uploaded:", startFrameUrl);
      imageUrls.push(startFrameUrl);

      // Upload end frame if provided
      if (endFrameBase64) {
        console.log("📤 Uploading end frame...");
        const endUploadResponse = await fetch(`${KIE_FILE_UPLOAD_BASE}/api/file-base64-upload`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${KIE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            base64Data: endFrameBase64,
            fileName: `end-frame-${Date.now()}.png`,
          }),
        });

        if (!endUploadResponse.ok) {
          const errText = await endUploadResponse.text();
          console.error("❌ End frame upload failed:", endUploadResponse.status, errText);
          // Continue without end frame - just use start frame
          console.log("⚠️ Continuing without end frame");
        } else {
          const endUploadData = await endUploadResponse.json();
          const endFrameUrl = endUploadData.data?.downloadUrl || endUploadData.data?.fileUrl;
          if (endFrameUrl) {
            console.log("✅ End frame uploaded:", endFrameUrl);
            imageUrls.push(endFrameUrl);
          }
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
        body: JSON.stringify({
          prompt,
          imageUrls,
          model,
        }),
      });

      if (!generateResponse.ok) {
        const errText = await generateResponse.text();
        console.error("❌ Video generation failed:", generateResponse.status, errText);
        
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
        return new Response(
          JSON.stringify({ success: false, error: "Keine Task-ID erhalten" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log("✅ Video generation started, taskId:", generatedTaskId);

      return new Response(
        JSON.stringify({ success: true, taskId: generatedTaskId }),
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
          headers: {
            "Authorization": `Bearer ${KIE_API_KEY}`,
          },
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
      const taskStatus = statusData.data?.status;
      const resultUrls = statusData.data?.response?.resultUrls || statusData.data?.resultUrls || [];

      console.log("📊 Task status:", taskStatus, "Result URLs:", resultUrls.length);

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
