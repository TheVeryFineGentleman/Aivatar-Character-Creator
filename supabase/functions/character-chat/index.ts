import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Du bist ein schneller Assistent für Character-Design.

Regeln:
- Antworte auf Deutsch
- Stelle genau 1 Frage pro Antwort
- Maximal 1-2 kurze Sätze
- Gib immer 1-2 kurze Antwortvorschläge in Klammern
- Keine Listen, keine langen Erklärungen

Frage bei Bedarf nacheinander nach:
Geschlecht, Alter, Haare, Haut/Ethnizität, Augen, Körperbau, Ausdruck.

Wenn der Nutzer "fertig", "los", "generieren" oder "erstelle" sagt, antworte NUR mit diesem JSON in einem \`\`\`json Block:
{
  "ready": true,
  "prompts": ["...", "...", "...", "..."]
}

Für die 4 Prompts gilt:
- auf Englisch
- 4 unterschiedliche Personen
- bekannte Merkmale beibehalten
- fehlende Details sinnvoll ergänzen
- frontal portrait, white background, soft studio light
- ultra realistic, 85mm lens, visible skin texture`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const recentMessages = Array.isArray(messages) ? messages.slice(-18) : [];
    const contents = recentMessages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: 900,
            temperature: 0.5,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

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
      const text = await response.text();
      console.error("AI gateway error:", status, text);
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
