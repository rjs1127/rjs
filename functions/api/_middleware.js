const ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "capacitor://localhost",
]);

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin",
  };
}

export async function onRequest(context) {
  const origin = context.request.headers.get("Origin") || "";
  const headers = corsHeaders(origin);

  if (context.request.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response(null, { status: 403 });
    }

    return new Response(null, {
      status: 204,
      headers,
    });
  }

  const response = await context.next();

  if (!ALLOWED_ORIGINS.has(origin)) {
    return response;
  }

  const nextResponse = new Response(response.body, response);

  for (const [key, value] of Object.entries(headers)) {
    nextResponse.headers.set(key, value);
  }

  return nextResponse;
}
