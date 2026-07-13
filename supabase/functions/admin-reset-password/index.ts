import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Methode non autorisee." }, 405);
  }

  const admin = await requireAdmin(req);
  if ("response" in admin) return admin.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return jsonResponse({ error: "Corps JSON invalide." }, 400);
  }

  const userId = String(body.userId || "").trim();
  const newPassword = String(body.newPassword || "");

  if (!userId) {
    return jsonResponse({ error: "Identifiant utilisateur manquant." }, 400);
  }

  if (newPassword.length < 8) {
    return jsonResponse({ error: "Le nouveau mot de passe doit comporter au moins 8 caracteres." }, 400);
  }

  const { error } = await admin.client.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  return jsonResponse({ success: true });
});
