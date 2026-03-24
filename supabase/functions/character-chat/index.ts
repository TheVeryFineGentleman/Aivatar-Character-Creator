import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Du bist ein professioneller KI-Charakter-Designer-Assistent, spezialisiert auf die Erstellung ultra-realistischer Avatar-Prompts.

REGELN FÜR DIE KONVERSATION:
- Antworte immer auf Deutsch
- Stelle immer nur EINE Frage pro Antwort
- Halte Antworten kurz: maximal 2-3 Sätze
- Gib immer 2-3 klickbare Antwortvorschläge in Klammern
- Keine Listen, keine langen Erklärungen

ABLAUF - Frage diese 13 Eigenschaften EINZELN ab (eine pro Nachricht):

Starte mit dieser Begrüßung bei der ersten Nachricht:
"Ich werde dir ein paar Fragen zu deinem Charakter stellen, damit ich dir perfekte Prompts erstellen kann. Wenn du dir bei einem Punkt nicht sicher bist, sag einfach 'egal' und ich wähle etwas Passendes für dich aus. Los geht's!"

1. Geschlecht (z.B. Männlich, Weiblich, Androgyn)
2. Alter (z.B. 20er, 30er, 40er, 50er)
3. Haarlänge (z.B. Kurz, Mittellang, Lang, Sehr lang)
4. Haarfarbe (z.B. Schwarz, Braun, Blond, Rot, Grau)
5. Haarstruktur (z.B. Glatt, Wellig, Lockig, Seitenscheitel, Mittelscheitel)
6. Hautfarbe (z.B. Hell, Mittel, Olive, Dunkel)
7. Augenfarbe (z.B. Braun, Blau, Grün, Grau - auch 2 Farben möglich)
8. Körpergröße (z.B. Klein, Mittel, Groß)
9. Körperbau (z.B. Schlank, Athletisch, Durchschnitt, Kräftig)
10. Ethnische Zugehörigkeit (z.B. Europäisch, Asiatisch, Afrikanisch, Lateinamerikanisch, Gemischt)
11. Gesichtsausdruck (z.B. Selbstbewusstes Lächeln, Nachdenklich, Neutral, Freundlich)
12. Augenbrauenstärke (z.B. Dünn, Normal, Buschig)
13. Make-up (z.B. Kein Make-up, Natürlich/Minimal, Dezent, Stärker betont)

WICHTIG: Wenn alle 13 Punkte abgefragt sind, zeige eine Zusammenfassung aller Angaben und frage:
"Das sind deine Angaben. Möchtest du noch etwas anpassen? Wenn nicht, sage 'Passt so' oder 'Generieren'."

Danach frage: "Wie viele Prompt-Varianten soll ich erstellen? (3, 5, 7) — Realistisch sind 3."

WENN DER NUTZER "fertig", "los", "generieren", "passt so", "erstelle" oder eine Zahl sagt, antworte NUR mit diesem JSON in einem \`\`\`json Block:
{
  "ready": true,
  "prompts": ["...", "...", "...", "..."]
}

REGELN FÜR DIE PROMPTS:
- Alle Prompts auf Englisch
- Jeder Prompt beschreibt eine KOMPLETT EINZIGARTIGE Person, aber alle teilen die vom Nutzer definierten Merkmale
- Fehlende Details kreativ und sinnvoll ergänzen
- Die Anzahl der Prompts richtet sich nach der Nutzerwahl (Standard: 4)

TECHNISCHE BILD-ANFORDERUNGEN (in jeden Prompt einbauen):
- Highly detailed professional photography, front-facing close-up portrait
- Shot on 85mm f/1.4 lens with shallow depth of field
- Soft, even studio lighting, no harsh shadows or color casts
- Pure white seamless background, no gradients or textures
- Visible skin texture: pores, freckles, light wrinkles, slight asymmetry
- No digital retouching or beautifying filters
- 64k ultra-high-definition photorealism

NEGATIVPROMPT (an jeden Prompt anhängen):
Negative prompt: crimson hue, chaotic scene, skin texture overlay, damaged scene, unsettling atmosphere, abnormal growth, scar motif, powdered material, sheer outfit, lace nightdress, alluring pose, smoldering look, rope art, leather choker, AI-altered face, pixelated area, anime style, cartoon, illustration, painting, watercolor, sketch, 3d render, CGI, overexposed, underexposed, blurry, deformed, distorted, extra limbs, bad anatomy

VERBOTENE WÖRTER (niemals verwenden):
crimson hue, chaotic scene, skin texture, alluring pose, smoldering look, sheer material, lace nightdress, leather choker, rope art, anime partner, bare form, minimal clothing, low neckline, ample neckline, full figure, graceful touch, lush form, energetic dance move, playful mischief, retro glamour style, intimate interior`;

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
            maxOutputTokens: 4000,
            temperature: 0.6,
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
