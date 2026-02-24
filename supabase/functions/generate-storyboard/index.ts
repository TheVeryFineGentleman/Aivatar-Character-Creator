import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { idea, sceneCount, format, genre, generateDialogues, generateTransitions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Du bist ein professioneller Storyboard-Autor und Filmemacher. Du erstellst strukturierte Storyboards für KI-generierte Videos.

Erstelle ein vollständiges Storyboard basierend auf der gegebenen Story-Idee.

WICHTIG: Antworte NUR mit dem Tool-Call, kein zusätzlicher Text.`;

    const userPrompt = `Erstelle ein Storyboard mit ${sceneCount} Szenen im Format ${format}.
${genre ? `Genre/Stil: ${genre}` : ""}
${generateDialogues ? "Erstelle realistische Dialoge/Sprechertexte pro Szene." : "Keine Dialoge."}
${generateTransitions ? "Erstelle passende Übergänge zwischen den Szenen." : "Keine Übergänge."}

Story-Idee: ${idea}

Erstelle für jede Szene:
- Eine kurze Zusammenfassung (summary)
- Eine detaillierte Beschreibung (detailedDescription) 
- Den spezifischen Bereich/Ort (specificArea)
- Die Schlüsselaktion (keyAction)
- Das Handlungsziel (goal)
- Die Emotion (emotion) - z.B. nachdenklich, fröhlich, angespannt, melancholisch
- Die Publikumswirkung (audienceEffect) - z.B. Spannung, Mitgefühl, Überraschung
- Kamera-Einstellung (shotType) - z.B. Close-Up, Medium Shot, Wide Shot, Over-the-Shoulder
- Kamerawinkel (cameraAngle) - z.B. Frontal, Leicht seitlich, Vogelperspektive
- Bildkomposition (composition) - z.B. Drittel-Regel, Zentriert, Rahmen im Rahmen
${generateDialogues ? "- Dialog/Sprechertext (dialogText) - realistischer Dialog oder Narration" : ""}
${generateTransitions ? "- Übergangstyp zur nächsten Szene (transitionType) - cut, fade, dissolve, match-cut, whip-pan" : ""}
${generateTransitions ? "- Übergangsdauer in Sekunden (transitionDuration)" : ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_storyboard",
              description: "Creates a complete storyboard with scenes, dialogues and transitions",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Story title" },
                  summary: { type: "string", description: "Short story summary (1-2 sentences)" },
                  scenes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        summary: { type: "string" },
                        detailedDescription: { type: "string" },
                        specificArea: { type: "string" },
                        keyAction: { type: "string" },
                        goal: { type: "string" },
                        emotion: { type: "string" },
                        audienceEffect: { type: "string" },
                        shotType: { type: "string" },
                        cameraAngle: { type: "string" },
                        composition: { type: "string" },
                        dialogText: { type: "string" },
                        styleNotes: { type: "string" },
                      },
                      required: ["summary", "detailedDescription", "specificArea", "keyAction", "goal", "emotion", "audienceEffect", "shotType", "cameraAngle", "composition"],
                      additionalProperties: false,
                    },
                  },
                  transitions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        fromIndex: { type: "number" },
                        toIndex: { type: "number" },
                        type: { type: "string", enum: ["cut", "fade", "dissolve", "match-cut", "whip-pan", "smash-cut", "l-cut", "j-cut"] },
                        duration: { type: "number" },
                        continuityNote: { type: "string" },
                      },
                      required: ["fromIndex", "toIndex", "type", "duration"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "summary", "scenes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_storyboard" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte versuche es in einer Minute erneut." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Guthaben aufgebraucht. Bitte lade dein Konto auf." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "KI-Fehler bei der Storyboard-Generierung" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: "Unerwartete KI-Antwort" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storyboardData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(storyboardData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-storyboard error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
