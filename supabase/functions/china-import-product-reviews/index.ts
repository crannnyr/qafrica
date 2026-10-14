import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("");

async function getLink(db: any, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const { data: link } = await db.from("china_import_review_links").select("id,order_id,customer_id,expires_at").eq("token_hash",tokenHash).gt("expires_at",new Date().toISOString()).maybeSingle();
  return link ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:CORS});
  if (!["GET","POST"].includes(req.method)) return json({error:"Method not allowed"},405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if(!url||!key) return json({error:"Service unavailable"},500);
  const db=createClient(url,key);
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
    const item=eligible.find((i:any)=>i.product_id===productId);
    const {data:existing}=await db.from("mock_reviews").select("id").eq("order_id",order.id).eq("product_id",productId).maybeSingle();
    if(existing) return json({error:"You have already reviewed this product for this order."},409);

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
      images:[],
      is_verified_purchase:true,
      helpful_count:0,
      created_at:new Date().toISOString()
    };
    const {error:insertError}=await db.from("mock_reviews").insert(review);
    if(insertError) {
      if(insertError.code==="23505") return json({error:"You have already reviewed this product for this order."},409);
      return json({error:"Could not save your review. Please try again."},500);
    }
    return json({ok:true},201);
  } catch(error) {
    console.error("china-import-product-reviews error",error);
    return json({error:"Unexpected server error."},500);
  }
});
