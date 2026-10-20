export default async (request: Request) => {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  if (
    url.pathname === "/" &&
    (hostname === "qafrica.ng" || hostname === "www.qafrica.ng")
  ) {
    url.pathname = "/stores-v2";
    return Response.redirect(url.toString(), 302);
  }

  return fetch(request);
};
