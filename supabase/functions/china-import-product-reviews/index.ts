import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("");
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string,string> = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" };

async function getLink(db: any, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const { data: link } = await db.from("china_import_review_links").select("id,order_id,customer_id,expires_at").eq("token_hash",tokenHash).gt("expires_at",new Date().toISOString()).maybeSingle();
  return link ?? null;
}

async function uploadReviewImages(db: any, orderId: string, productId: string, values: unknown): Promise<{urls:string[];paths:string[]}> {
  if (values === undefined || values === null) return { urls: [], paths: [] };
  if (!Array.isArray(values) || values.length > MAX_IMAGES) throw new Error(`You can attach up to ${MAX_IMAGES} images per review.`);
  const urls: string[] = [];
  const paths: string[] = [];
  for (const image of values) {
    if (!image || typeof image !== "object" || typeof image.type !== "string" || typeof image.data !== "string") throw new Error("One of the selected images is invalid.");
    const ext = MIME_EXTENSIONS[image.type];
    if (!ext) throw new Error("Use JPG, PNG, or WEBP images only.");
    const raw = atob(image.data);
    if (raw.length === 0 || raw.length > MAX_IMAGE_BYTES) throw new Error("Each image must be smaller than 5 MB.");
    const bytes = new Uint8Array(raw.length);
    for (let i=0;i<raw.length;i++) bytes[i] = raw.charCodeAt(i);
    const path = `china-import/${orderId}/${productId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("review-images").upload(path, bytes, { contentType: image.type, upsert: false, cacheControl: "31536000" });
    if (error) {
      if (paths.length) await db.storage.from("review-images").remove(paths);
      throw new Error("Could not upload your review images. Please try again.");
    }
    paths.push(path);
    const { data } = db.storage.from("review-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return { urls, paths };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:CORS});
  if (!["GET","POST"].includes(req.method)) return json({error:"Method not allowed"},405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if(!url||!key) return json({error:"Service unavailable"},500);
  const db=createClient(url,key);
  let uploadedPaths: string[] = [];
  try {
    const body = req.method === "POST" ? await req.json().catch(()=>({})) : {};
    const token = req.method === "GET" ? new URL(req.url).searchParams.get("token") : body.token;
    if(typeof token!=="string") return json({error:"Review link is invalid or expired."},404);
    const link=await getLink(db,token);
    if(!link) return json({error:"Review link is invalid or expired."},404);

    const {data:order,error:orderError}=await db.from("china_import_orders").select("id,code,customer_name,user_id").eq("id",link.order_id).maybeSingle();
    if(orderError||!order) return json({error:"Order not found."},404);
    const {data:items,error:itemsError}=await db.from("china_import_fulfillment_items")
      .select("product_id,product_name,image_url,variant_options,ordered_quantity,delivered_quantity")
      .eq("order_id",order.id).order("order_item_index",{ascending:true});
    if(itemsError) return json({error:"Could not load order products."},500);
    const eligible=(items??[]).filter((i:any)=>i.product_id && Number(i.ordered_quantity)>0 && Number(i.delivered_quantity)>=Number(i.ordered_quantity));
    if(req.method==="GET") {
      const {data:reviews}=await db.from("mock_reviews").select("product_id").eq("order_id",order.id);
      const reviewed=new Set((reviews??[]).map((r:any)=>r.product_id));
      return json({
        order_code:order.code,
        customer_name:order.customer_name || "",
        items:eligible.map((i:any)=>({product_id:i.product_id,product_name:i.product_name,image_url:i.image_url,variant_options:i.variant_options??{},ordered_quantity:i.ordered_quantity,delivered_quantity:i.delivered_quantity,reviewed:reviewed.has(i.product_id)}))
      });
    }

    const productId=body.product_id;
    const rating=Number(body.rating);
    const title=typeof body.title==="string"?body.title.trim().slice(0,120):"";
    const content=typeof body.content==="string"?body.content.trim().slice(0,3000):"";
    if(typeof productId!=="string"||!eligible.some((i:any)=>i.product_id===productId)) return json({error:"This product is not eligible for review from this order."},400);
    if(!Number.isInteger(rating)||rating<1||rating>5) return json({error:"Choose a rating from 1 to 5 stars."},400);
    if(content.length<3) return json({error:"Please write a review of at least 3 characters."},400);
    if(body.images !== undefined && (!Array.isArray(body.images) || body.images.length > MAX_IMAGES)) return json({error:`You can attach up to ${MAX_IMAGES} images per review.`},400);
    const item=eligible.find((i:any)=>i.product_id===productId);
    const {data:existing}=await db.from("mock_reviews").select("id").eq("order_id",order.id).eq("product_id",productId).maybeSingle();
    if(existing) return json({error:"You have already reviewed this product for this order."},409);

    const uploaded = await uploadReviewImages(db, order.id, productId, body.images);
    uploadedPaths = uploaded.paths;
    const review={
      order_id:order.id,
      product_id:productId,
      product_name:item.product_name,
      customer_name:order.customer_name || "Verified customer",
      is_username:false,
      customer_avatar_url:null,
      rating,
      title:title||null,
      content,
      images:uploaded.urls,
      is_verified_purchase:true,
      moderation_status:"pending",
      helpful_count:0,
      created_at:new Date().toISOString()
    };
    const {error:insertError}=await db.from("mock_reviews").insert(review);
    if(insertError) {
      if(uploadedPaths.length) await db.storage.from("review-images").remove(uploadedPaths);
      if(insertError.code==="23505") return json({error:"You have already reviewed this product for this order."},409);
      return json({error:"Could not save your review. Please try again."},500);
    }
    uploadedPaths = [];
    return json({ok:true, image_count:uploaded.urls.length},201);
  } catch(error) {
    if(uploadedPaths.length) await db.storage.from("review-images").remove(uploadedPaths);
    console.error("china-import-product-reviews error",error);
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = /image|JPG|PNG|WEBP|5 MB|attach up to/i.test(message) ? 400 : 500;
    return json({error:message},status);
  }
});
