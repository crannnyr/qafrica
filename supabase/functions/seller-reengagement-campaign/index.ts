import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = (Deno.env.get("APP_URL") || "https://qafrica.store").replace(/\/$/, "");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Candidate = {
  campaign_id: string;
  user_id: string;
  store_id: string;
  email: string;
  full_name: string | null;
  store_name: string;
  niches: string[] | null;
  product_count: number;
  current_step: number;
};

type Product = {
  id: string;
  name: string;
  niche: string | null;
  category: string | null;
  dropship_price: number | null;
  selling_price: number | null;
  stock_quantity: number | null;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

function naira(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? "₦" + amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })
    : "check the current catalog price";
}

function emailShell(content: string, firstName: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#172033">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:28px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden">
  <tr><td style="background:#f97316;padding:20px 28px;color:#fff;font-size:21px;font-weight:800;letter-spacing:.4px">QAFRICA</td></tr>
  <tr><td style="padding:28px;line-height:1.65">
  <p style="margin:0 0 18px;color:#475569">Hi ${escapeHtml(firstName)},</p>
  ${content}
  <p style="margin:24px 0 0;color:#64748b;font-size:13px">You’re receiving this because you have a paid QAfrica store. These check-ins stop when your store records a sale. If you need help, reply to this email and our team can assist.</p>
  </td></tr><tr><td style="padding:16px 28px;background:#fff7ed;color:#9a3412;font-size:12px">QAfrica · Build your store, one step at a time.</td></tr>
  </table></td></tr></table></body></html>`;
}

function button(label: string, href: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">${escapeHtml(label)} →</a></p>`;
}

function renderEmail(step: number, c: Candidate, product: Product | null) {
  const firstName = (c.full_name || "").trim().split(/\s+/)[0] || "there";
  const storeName = escapeHtml(c.store_name || "your store");
  const catalogUrl = `${APP_URL}/dashboard/catalog`;
  const productsUrl = `${APP_URL}/dashboard/products`;
  const addUrl = `${APP_URL}/dashboard/products/add`;
  const rec = product ? `
    <div style="padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;margin:18px 0">
      <div style="font-weight:700;font-size:17px">${escapeHtml(product.name)}</div>
      <div style="font-size:13px;color:#64748b;margin:5px 0 10px">${escapeHtml(product.niche || product.category || "Marketplace pick")}</div>
      <div style="font-size:14px">Catalog cost: <strong>${naira(product.dropship_price)}</strong></div>
      <div style="font-size:14px">Listed selling price: <strong>${naira(product.selling_price)}</strong></div>
      ${Number(product.selling_price) > Number(product.dropship_price) ? `<div style="font-size:14px;color:#166534;margin-top:5px">Example price gap: <strong>${naira(Number(product.selling_price) - Number(product.dropship_price))}</strong></div>` : ""}
      <div style="font-size:12px;color:#64748b;margin-top:8px">Prices and stock can change. The price gap is not guaranteed profit; consider delivery, platform charges, and your own costs.</div>
    </div>` : "";
  const noProducts = Number(c.product_count) === 0;
  const intro = noProducts
    ? `Your store, <strong>${storeName}</strong>, is ready for its first product. You do not need to buy stock upfront to get started with dropshipping.`
    : `You have products in <strong>${storeName}</strong>, but we haven’t seen a paid sale yet. A few focused improvements can help visitors understand what to buy.`;

  const messages: Array<{subject: string; heading: string; body: string; cta: string; href: string}> = [
    { subject: "Your first QAfrica sale starts with one small step", heading: "Let’s get your store moving", body: noProducts ? "Start by choosing one product that fits the kind of customer you want to serve. You can browse the import catalog and add a product without purchasing inventory first." : "Start with your strongest product. Check that its photo, title, price, and description make the value clear within a few seconds.", cta: noProducts ? "Browse products to import" : "Review my products", href: noProducts ? catalogUrl : productsUrl },
    { subject: "A simple product-picking method for " + c.store_name, heading: "Choose for a specific customer", body: "Instead of listing everything, think of one customer group and the problem they want solved. Your store niches can help narrow the choices and make your product selection feel consistent.", cta: "Explore the import catalog", href: catalogUrl },
    { subject: "One product photo can change the first impression", heading: "Make the product easy to understand", body: "Use a clear, well-lit image that shows the item itself. Add extra angles when available, and make sure the first image is easy to understand on a phone screen.", cta: "Improve my product pages", href: productsUrl },
    { subject: "Check your price before you share your store", heading: "Make the price make sense", body: "Compare similar products, account for delivery and platform charges, and decide what value your store adds. Avoid setting a price based only on what another seller charges.", cta: "Review my product prices", href: productsUrl },
    { subject: "A product idea for your QAfrica niche", heading: "A catalog pick worth reviewing", body: product ? "Here is one current catalog item related to your store’s niche. Review its images, stock, and current prices before deciding whether it fits your audience." : "Open the import catalog and filter for products that match your store’s niche. Check product photos, stock availability, and the current cost before importing.", cta: "View the import catalog", href: catalogUrl },
    { subject: "Help customers trust your store", heading: "Answer the questions buyers already have", body: "Clear product details, accurate delivery expectations, and visible contact information reduce uncertainty. Read your storefront as if you were a first-time visitor who has never heard of your business.", cta: "Open my storefront settings", href: `${APP_URL}/dashboard/store-setup` },
    { subject: "Try a focused product collection this week", heading: "Keep your store easy to browse", body: "A small collection around one theme can be easier to understand than a scattered catalog. If you have no products yet, add a few related items; if you do, remove anything that distracts from your main offer.", cta: noProducts ? "Choose products" : "Manage products", href: noProducts ? catalogUrl : productsUrl },
    { subject: "Give your store link a real audience", heading: "Share where your customers already are", body: "Share a useful product or collection with people who are likely to care about it. Add a short explanation of who it helps instead of posting a bare link with no context.", cta: "Open my store dashboard", href: `${APP_URL}/dashboard` },
    { subject: "A quick 10-minute QAfrica store check", heading: "Use this quick checklist", body: "Check these four things: a clear product image, a specific title, a complete description, and a price that covers your costs. Then open the store on your phone and make sure the buying steps are easy to follow.", cta: "Run through my store", href: productsUrl },
    { subject: "Your QAfrica next step: turn setup into action", heading: "Ready for your next step?", body: noProducts ? "Pick one product today and complete its details. You can add more later; getting one suitable product live is a practical first milestone." : "Choose one product to improve, share it with a relevant audience, and review the result. Small, repeatable improvements are more useful than changing everything at once.", cta: noProducts ? "Add my first product" : "Open my products", href: noProducts ? addUrl : productsUrl },
  ];

  const m = messages[step];
  const body = `<h1 style="font-size:25px;line-height:1.25;margin:0 0 12px;color:#111827">${escapeHtml(m.heading)}</h1>
    <p style="color:#475569;margin:0 0 14px">${intro}</p>
    <p style="color:#475569;margin:0 0 14px">${m.body}</p>
    ${step === 4 ? rec : ""}
    ${button(m.cta, m.href)}
    <p style="color:#64748b;font-size:13px">No pressure to do everything at once—choose the next step that makes sense for your business.</p>`;
  return { subject: m.subject, html: emailShell(body, firstName) };
}

async function chooseProduct(candidate: Candidate): Promise<Product | null> {
  let query = supabase
    .from("products")
    .select("id,name,niche,category,dropship_price,selling_price,stock_quantity")
    .eq("is_active", true)
    .eq("is_importable", true)
    .gte("stock_quantity", 5)
    .gt("dropship_price", 0)
    .order("sales_count", { ascending: false })
    .limit(1);

  const niches = (candidate.niches || []).filter((n) => typeof n === "string" && n.trim()).slice(0, 10);
  if (niches.length) query = query.in("niche", niches);
  const { data, error } = await query;
  if (error) {
    console.error("[seller-reengagement] product recommendation lookup failed:", error.message);
    return null;
  }
  if (data?.[0]) return data[0] as Product;

  const fallback = await supabase
    .from("products")
    .select("id,name,niche,category,dropship_price,selling_price,stock_quantity")
    .eq("is_active", true)
    .eq("is_importable", true)
    .gte("stock_quantity", 5)
    .gt("dropship_price", 0)
    .order("sales_count", { ascending: false })
    .limit(1);
  return fallback.data?.[0] ? fallback.data[0] as Product : null;
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Cron and trusted operators must call with the project service-role JWT.
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: sync, error: syncError } = await supabase.rpc("sync_seller_reengagement_enrollments");
  if (syncError) {
    console.error("[seller-reengagement] enrollment sync failed:", syncError.message);
    return Response.json({ error: "enrollment_sync_failed" }, { status: 500 });
  }

  const { data: due, error: dueError } = await supabase.rpc("get_seller_reengagement_due");
  if (dueError) {
    console.error("[seller-reengagement] due campaign query failed:", dueError.message);
    return Response.json({ error: "due_campaign_query_failed" }, { status: 500 });
  }

  let queued = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const raw of (due || []) as Candidate[]) {
    if (raw.current_step < 0 || raw.current_step > 9) { skipped++; continue; }
    const product = raw.current_step === 4 ? await chooseProduct(raw) : null;
    const rendered = renderEmail(raw.current_step, raw, product);
    const { data, error } = await supabase.rpc("queue_seller_reengagement_email", {
      p_campaign_id: raw.campaign_id,
      p_step: raw.current_step,
      p_subject: rendered.subject,
      p_html: rendered.html,
    });
    if (error) {
      errors.push(`${raw.campaign_id}: ${error.message}`);
      continue;
    }
    if (data?.queued) queued++;
    else skipped++;
  }

  return Response.json({
    enrolled: sync?.enrolled ?? 0,
    exited: sync?.exited ?? 0,
    due: due?.length ?? 0,
    queued,
    skipped,
    errors,
  });
});
