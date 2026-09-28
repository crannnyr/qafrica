import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function authorize(supabase: any, token: unknown, permissionKey: string) {
  if (typeof token !== "string" || !token) return null;

  const { data: session } = await supabase
    .from("import_admin_sessions")
    .select("manager_id, expires_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!session?.manager_id) return null;

  const { data: manager } = await supabase
    .from("import_admin_managers")
    .select("id, email, full_name, is_active")
    .eq("id", session.manager_id)
    .maybeSingle();

  if (!manager?.is_active || typeof manager.email !== "string" || !manager.email.endsWith("@qafrica.store")) return null;

  const { data: roles } = await supabase
    .from("import_admin_manager_roles")
    .select("role_id")
    .eq("manager_id", manager.id);

  const roleIds = (roles ?? []).map((r: any) => r.role_id).filter(Boolean);
  const { data: rolePermissions } = roleIds.length
    ? await supabase.from("import_admin_role_permissions").select("permission_id").in("role_id", roleIds)
    : { data: [] };

  const { data: direct } = await supabase
    .from("import_admin_manager_permissions")
    .select("permission_id")
    .eq("manager_id", manager.id);

  const { data: denied } = await supabase
    .from("import_admin_manager_denied_permissions")
    .select("permission_id")
    .eq("manager_id", manager.id);

  const deniedIds = new Set((denied ?? []).map((r: any) => r.permission_id).filter(Boolean));
  const permissionIds = Array.from(new Set([
    ...(rolePermissions ?? []).map((r: any) => r.permission_id),
    ...(direct ?? []).map((r: any) => r.permission_id),
  ])).filter((id: any) => id && !deniedIds.has(id));

  if (!permissionIds.length) return null;

  const { data: permission } = await supabase
    .from("import_admin_permissions")
    .select("id")
    .in("id", permissionIds)
    .eq("key", permissionKey)
    .maybeSingle();

  return permission ? manager : null;
}

function cleanImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map(v => v.trim()).slice(0, 8);
}

function validateReview(body: any) {
  const rating = Number(body.rating);
  if (!body.product_id || typeof body.product_id !== "string") throw new Error("Product is required.");
  if (!body.customer_name || typeof body.customer_name !== "string") throw new Error("Reviewer is required.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5.");
  if (!body.content || typeof body.content !== "string" || !body.content.trim()) throw new Error("Review content is required.");
  return {
    product_id: body.product_id,
    product_name: typeof body.product_name === "string" ? body.product_name.trim() : null,
    customer_name: body.customer_name.trim(),
    is_username: Boolean(body.is_username),
    customer_avatar_url: typeof body.customer_avatar_url === "string" && body.customer_avatar_url.trim() ? body.customer_avatar_url.trim() : null,
    rating,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : null,
    content: body.content.trim(),
    images: cleanImages(body.images),
    is_verified_purchase: body.is_verified_purchase !== false,
    helpful_count: Math.max(0, Math.floor(Number(body.helpful_count) || 0)),
    created_at: body.created_at ? new Date(body.created_at).toISOString() : new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const managerToken = body.manager_token;

    const manager = await authorize(
      supabase,
      managerToken,
      action === "list" || action === "reviewers" ? "import.reviews.view" : "import.reviews.manage",
    );
    if (!manager) return json({ error: "You do not have permission to manage import reviews." }, 403);

    if (action === "reviewers") {
      const { data, error } = await supabase.from("mock_review_users").select("*").order("display_name", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ reviewers: data ?? [] });
    }

    if (action === "list") {
      let query = supabase
        .from("mock_reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (body.product_id) query = query.eq("product_id", body.product_id);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ reviews: data ?? [] });
    }

    if (action === "create-review") {
      const review = validateReview(body);
      const { data, error } = await supabase.from("mock_reviews").insert(review).select("*").single();
      if (error) return json({ error: error.message }, 400);
      return json({ review: data });
    }

    if (action === "update-review") {
      if (!body.id) return json({ error: "Review ID is required." }, 400);
      const review = validateReview(body);
      delete (review as any).created_at;
      const { data, error } = await supabase.from("mock_reviews").update(review).eq("id", body.id).select("*").single();
      if (error) return json({ error: error.message }, 400);
      return json({ review: data });
    }

    if (action === "delete-review") {
      if (!body.id) return json({ error: "Review ID is required." }, 400);
      const { error } = await supabase.from("mock_reviews").delete().eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "create-reviewer") {
      if (!body.display_name || typeof body.display_name !== "string" || !body.display_name.trim()) {
        return json({ error: "Reviewer name is required." }, 400);
      }
      const { data, error } = await supabase.from("mock_review_users").insert({
        display_name: body.display_name.trim(),
        is_username: Boolean(body.is_username),
      }).select("*").single();
      if (error) return json({ error: error.message }, 400);
      return json({ reviewer: data });
    }

    if (action === "delete-reviewer") {
      if (!body.id) return json({ error: "Reviewer ID is required." }, 400);
      const { data: reviewer } = await supabase.from("mock_review_users").select("display_name").eq("id", body.id).maybeSingle();
      if (!reviewer) return json({ error: "Reviewer not found." }, 404);
      const { error } = await supabase.from("mock_review_users").delete().eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 400);
  }
});
