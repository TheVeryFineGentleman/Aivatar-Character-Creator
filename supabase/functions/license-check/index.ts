import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, licenseKey } = await req.json();
    
    console.log("📤 Proxying license check request");
    console.log("📧 Email:", email);
    
    // Forward request to external API
    const response = await fetch("https://key-manager-wmmjk.ondigitalocean.app/api/license/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toolApiKey: "1234",
        licenseKey: licenseKey,
        email: email,
      }),
    });

    const data = await response.json();
    console.log("📥 Response from license API:", data);

    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: response.status,
      }
    );
  } catch (error) {
    console.error("❌ Error in license-check:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: errorMessage 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});
