import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin.ts";

const ROLES = new Set([
  "admin_national",
  "superviseur_drena",
  "superviseur_iepp",
  "enqueteur",
  "lecteur",
]);

function roleRequiresDrena(role: string): boolean {
  return role === "superviseur_drena" || role === "superviseur_iepp" || role === "enqueteur";
}

function roleRequiresIepp(role: string): boolean {
  return role === "superviseur_iepp";
}

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

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const nom = String(body.nom || "").trim();
  const prenom = String(body.prenom || "").trim();
  const role = String(body.role || "enqueteur");
  const telephone = String(body.telephone || "").trim() || null;
  const drenaId = String(body.drena_id || "").trim() || null;
  const ieppId = String(body.iepp_id || "").trim() || null;

  if (!email || !nom || !prenom) {
    return jsonResponse({ error: "Le nom, le prenom et l'e-mail sont obligatoires." }, 400);
  }

  if (password.length < 8) {
    return jsonResponse({ error: "Le mot de passe doit comporter au moins 8 caracteres." }, 400);
  }

  if (!ROLES.has(role)) {
    return jsonResponse({ error: "Role utilisateur invalide." }, 400);
  }

  if (roleRequiresDrena(role) && !drenaId) {
    return jsonResponse({ error: "La DRENA de rattachement est obligatoire pour ce role." }, 400);
  }

  if (roleRequiresIepp(role) && !ieppId) {
    return jsonResponse({ error: "L'IEPP de rattachement est obligatoire pour ce role." }, 400);
  }

  const { data, error } = await admin.client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom, prenom },
  });

  if (error || !data.user) {
    return jsonResponse({ error: error?.message || "Creation Auth impossible." }, 400);
  }

  const userRow = {
    id: data.user.id,
    email,
    nom,
    prenom,
    role,
    telephone,
    drena_id: roleRequiresDrena(role) ? drenaId : null,
    iepp_id: role === "superviseur_iepp" ? ieppId : null,
    actif: true,
  };

  const { error: profileError } = await admin.client
    .from("users")
    .upsert(userRow, { onConflict: "id" });

  if (profileError) {
    return jsonResponse({
      error: `Compte Auth cree, mais profil public.users impossible: ${profileError.message}`,
    }, 500);
  }

  return jsonResponse({ user: userRow });
});
