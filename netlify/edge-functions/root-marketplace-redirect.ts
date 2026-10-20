export default async (
  request: Request,
  context: { next: () => Promise<Response> },
) => {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  if (
    url.pathname === "/" &&
    (hostname === "qafrica.ng" || hostname === "www.qafrica.ng")
  ) {
    url.pathname = "/stores-v2";
    return Response.redirect(url.toString(), 302);
  }

  // Let every other domain and path continue through Netlify normally.
  return context.next();
};
