// Leitet Wetterabfragen an Open-Meteo weiter, damit die IP-Adresse der Besucher nicht an Dritte geht.
const ERLAUBT = ["latitude", "longitude", "elevation", "timezone", "forecast_days", "current", "hourly", "daily"];

export async function onRequestGet({ request }) {
  const ein = new URL(request.url).searchParams;
  const aus = new URLSearchParams();
  for (const name of ERLAUBT) if (ein.has(name)) aus.set(name, ein.get(name));
  const antwort = await fetch(`https://api.open-meteo.com/v1/forecast?${aus}`, { cf: { cacheTtl: 900, cacheEverything: true } });
  return new Response(antwort.body, {
    status: antwort.status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=900" },
  });
}
