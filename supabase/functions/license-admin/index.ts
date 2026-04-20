import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KEY_MANAGER_BASE = "https://key-manager-wmmjk.ondigitalocean.app";
const ADMIN_API_KEY = "9876";
const ALLOWED_EMAILS = new Set(["sattelite.de@gmail.com", "1", "2", "3"]);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const toolApiKey = Deno.env.get("KEY_MANAGER_API_KEY");
    if (!toolApiKey) {
      return json({ error: "KEY_MANAGER_API_KEY nicht konfiguriert" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    const requesterEmail =
      typeof body?.requesterEmail === "string" ? body.requesterEmail.trim().toLowerCase() : "";

    if (!ALLOWED_EMAILS.has(requesterEmail)) {
      return json({ error: "Nicht autorisiert" }, 403);
    }

    if (action === "lookup") {
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      if (!email) return json({ error: "email erforderlich" }, 400);

      const response = await fetch(`${KEY_MANAGER_BASE}/api/admin/license/lookup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-api-key": ADMIN_API_KEY,
        },
        body: JSON.stringify({ toolApiKey, email }),
      });

      const text = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        return json({ error: "Ungültige Antwort vom Key Manager", raw: text }, 502);
      }
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change-product") {
      const licenseKey = typeof body?.licenseKey === "string" ? body.licenseKey.trim() : "";
      const productId = body?.productId;
      if (!licenseKey || (typeof productId !== "number" && typeof productId !== "string")) {
        return json({ error: "licenseKey und productId erforderlich" }, 400);
      }

      const response = await fetch(`${KEY_MANAGER_BASE}/api/admin/license/change-product`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-api-key": ADMIN_API_KEY,
        },
        body: JSON.stringify({
          toolApiKey,
          licenseKey,
          productId: typeof productId === "string" ? Number(productId) : productId,
        }),
      });

      const text = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        return json({ error: "Ungültige Antwort vom Key Manager", raw: text }, 502);
      }
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return json({ error: "Unbekannte action" }, 400);
  } catch (error) {
    console.error("license-admin error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
