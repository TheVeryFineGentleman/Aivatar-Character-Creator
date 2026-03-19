import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Du bist ein Experte für Character-Design für KI-Bildgenerierung. Du sprichst Deutsch mit dem Nutzer, erstellst aber Prompts auf Englisch.

WICHTIGE REGELN FÜR DAS GESPRÄCH:
- Stelle immer nur EINE Frage pro Antwort
- Halte deine Antworten KURZ (maximal 2-3 Sätze)
- Gib nach jeder Frage 1-2 kurze Antwortvorschläge in Klammern, z.B. (z.B. "männlich" oder "weiblich")
- Sei freundlich aber direkt
- Keine langen Aufzählungen oder Listen

Deine Aufgabe: Führe ein kurzes Gespräch über den gewünschten Charakter. Frage nacheinander ab:
1. Geschlecht
2. Alter
3. Haarlänge & Haarfarbe
4. Hautfarbe & Ethnizität
5. Augenfarbe
6. Körperbau
7. Gesichtsausdruck

Wenn der Nutzer "fertig", "los", "generieren" oder "erstelle" sagt, erstelle die Prompts.

Antworte dann NUR mit diesem JSON-Format (kein anderer Text):
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

PROMPT-REGELN:
- Jeder Prompt beschreibt eine KOMPLETT ANDERE Person mit den beschriebenen Merkmalen aber unterschiedlichen Variationen
- Frontal-Porträt, weißer Hintergrund, weiches Studiolicht
- Ultra-realistisch, 85mm f/1.4, 64k
- Sichtbare Hauttextur, keine Filter, kein Make-up (außer gewünscht)
- Prompts auf ENGLISCH

Starte mit einer kurzen Begrüßung und frage nach dem Geschlecht.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Build Gemini API contents format
    const contents = [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: "Verstanden. Ich werde mich an diese Anweisungen halten." }] },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: 4000 },
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
