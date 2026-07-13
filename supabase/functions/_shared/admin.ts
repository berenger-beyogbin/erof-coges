import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "./cors.ts";

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
      response: jsonResponse({ error: `Profil admin introuvable: ${profileError.message}` }, 403),
    };
  }

  if (!profile || profile.role !== "admin_national" || profile.actif !== true) {
    return {
      response: jsonResponse({ error: "Action reservee a un admin national actif." }, 403),
    };
  }

  return { client, authUser: user };
}
