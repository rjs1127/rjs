export async function onRequestGet(context) {
  // v7.20 safety fallback. Normally excluded from "/" by public/_routes.json.
  return context.env.ASSETS.fetch(context.request);
}
