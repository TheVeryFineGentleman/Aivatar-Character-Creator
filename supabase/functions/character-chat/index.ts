import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert character designer for AI image generation. You speak German with the user but generate prompts in English.

Your job: Have a friendly conversation with the user about the character they want to create. Ask about appearance, style, personality, clothing, etc.

When the user says they're done (e.g. "fertig", "los", "generieren", "erstelle"), you MUST respond with a JSON block containing exactly 4 unique character prompts based on the conversation.

Each prompt should describe a COMPLETELY DIFFERENT and UNIQUE character that matches the user's described traits but with distinct variations in features, ethnicity, build, and look.

IMPORTANT RULES for prompts:
- Each prompt must describe exactly ONE person, front-facing portrait
- Pure white seamless background
- Soft, even studio lighting
- Ultra-realistic, professional photography, 85mm f/1.4 lens
- No makeup unless specified, no filters
- Visible skin texture, natural imperfections
- Each character must look COMPLETELY DIFFERENT from the others
- Prompts must be in ENGLISH

When ready to generate, respond with ONLY this JSON format (no other text):
\`\`\`json
{
  "ready": true,
  "prompts": [
    "prompt for character 1...",
    "prompt for character 2...",
    "prompt for character 3...",
    "prompt for character 4..."
  ]
}
\`\`\`

If the user is still chatting and not ready, respond normally in German. Ask helpful follow-up questions about their character. Be concise and friendly.

Start by greeting the user and asking about the character they want to create.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte warte einen Moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits aufgebraucht. Bitte lade dein Konto auf." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI Fehler aufgetreten" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("character-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
