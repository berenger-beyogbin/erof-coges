import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "./cors.ts";

function rawErrorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  const err = error as { message?: string; details?: string; hint?: string; code?: string };
  return [err.message, err.details, err.hint, err.code].filter(Boolean).join(" ");
}

export function userSafeAdminError(action: string, error?: unknown): string {
  const raw = rawErrorText(error).toLowerCase();
  console.warn(`[EROF Edge] ${action}`, error);

  if (raw.includes("already") || raw.includes("duplicate")) {
    return `Impossible de terminer ${action} : ces informations existent deja. Verifiez qu'il n'y a pas de doublon.`;
  }

  if (raw.includes("invalid email") || raw.includes("unable to validate email")) {
    return `Impossible de terminer ${action} : l'adresse e-mail saisie n'est pas valide.`;
  }

  if (raw.includes("password")) {
    return `Impossible de terminer ${action} : le mot de passe ne respecte pas les regles de securite.`;
  }

  if (raw.includes("row-level security") || raw.includes("permission denied")) {
    return `Impossible de terminer ${action} : votre compte n'a pas l'autorisation necessaire.`;
  }

  if (raw.includes("foreign key")) {
    return `Impossible de terminer ${action} : une donnee rattachee est introuvable. Rechargez la page puis reessayez.`;
  }

  return `Impossible de terminer ${action}. Verifiez les informations saisies puis reessayez.`;
}

export function serviceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAdmin(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return {
      response: jsonResponse({ error: "Jeton d'authentification manquant." }, 401),
    };
  }

  const client = serviceClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !user) {
    return {
      response: jsonResponse({ error: "Session invalide ou expiree." }, 401),
    };
  }

  const { data: profile, error: profileError } = await client
    .from("users")
    .select("role, actif")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      response: jsonResponse({ error: userSafeAdminError("la verification du profil administrateur", profileError) }, 403),
    };
  }

  if (!profile || profile.role !== "admin_national" || profile.actif !== true) {
    return {
      response: jsonResponse({ error: "Action reservee a un admin national actif." }, 403),
    };
  }

  return { client, authUser: user };
}
