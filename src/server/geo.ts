import { getDB, withDB, type GeoInfo } from "./db";

// Best-effort IP → location (country / region / city / ISP) with a light VPN/proxy
// heuristic. Results are CACHED per IP in db.geoCache so we hit the external service
// at most once per IP every couple of weeks (and never for private/LAN IPs). Every
// failure is swallowed — location is a "nice to have", never a blocker.

function isPrivate(ip: string): boolean {
  if (!ip) return true;
  const v = ip.replace(/^::ffff:/, "");
  if (v === "::1" || v === "0.0.0.0") return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|fc|fd|fe80)/i.test(v)) return true;
  const m = v.match(/^172\.(\d+)\./);
  if (m) { const n = Number(m[1]); if (n >= 16 && n <= 31) return true; }
  return false;
}

const GEO_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const GEO_V = 2; // bump to re-resolve cached IPs after a provider/accuracy change
const PROXY_HINT = /\b(vpn|proxy|hosting|datacenter|data center|cloud|colo|server farm|amazon|aws|google cloud|microsoft|azure|digitalocean|ovh|hetzner|linode|vultr|leaseweb|m247)\b/i;

/** The client's REAL IP from a request behind the nginx edge. Prefers X-Real-IP
 *  (nginx sets it to the real TCP peer — a client CANNOT spoof it), then the first
 *  X-Forwarded-For entry. This stops a client from faking its geo-location by sending
 *  its own X-Forwarded-For header (nginx appends to that header, it doesn't replace it). */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  return (req.headers.get("x-real-ip") || "").trim()
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "";
}

/** Look up (and cache) the geolocation of an IP. Returns undefined for private/local
 *  IPs or when the lookup can't complete. */
export async function geoLookup(ip?: string | null): Promise<GeoInfo | undefined> {
  const clean = (ip || "").trim();
  if (!clean || isPrivate(clean)) return undefined;
  const db = await getDB();
  const cached = db.geoCache?.[clean];
  // Only trust cache entries resolved by the CURRENT provider version — bumping GEO_V
  // makes every old (less-accurate) entry re-resolve with the new provider on next view.
  if (cached && cached.v === GEO_V) {
    const hasData = !!(cached.country || cached.city);
    // Successful lookups are cached for 14 days; a FAILED (empty) result is only
    // held for 1 hour so a transient network blip doesn't leave an IP location-less
    // for two weeks — it retries on the next view.
    const ttl = hasData ? GEO_TTL_MS : 60 * 60 * 1000;
    if (Date.now() - new Date(cached.at).getTime() < ttl) return hasData ? cached : undefined;
  }
  // Primary = ip-api.com (more accurate city data + mobile/proxy flags). If it can't
  // place the IP (unknown range, rate-limited, down) fall back through two more free
  // providers, so far fewer users end up location-less.
  let info = await lookupIpApi(clean);
  if (!info || (!info.country && !info.city)) {
    const alt = await lookupIpwho(clean);
    if (alt && (alt.country || alt.city)) info = alt;
  }
  if (!info || (!info.country && !info.city)) {
    const alt2 = await lookupFreeIpApi(clean);
    if (alt2 && (alt2.country || alt2.city)) info = alt2;
  }
  // Cache even a negative result (timestamp only) so a bad/unreachable IP isn't retried on every login.
  const toStore: GeoInfo = info ? { ...info, v: GEO_V } : { at: new Date().toISOString(), v: GEO_V };
  await withDB((d2) => { if (!d2.geoCache) d2.geoCache = {}; d2.geoCache[clean] = toStore; });
  return info;
}

/** One geo provider lookup with its own short timeout (armed across fetch + body read
 *  so a stalled response can't hang the caller). Returns undefined on any failure. */
async function timedFetch(url: string): Promise<unknown | undefined> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2200);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined; // network / timeout / abort / parse
  } finally {
    clearTimeout(timer);
  }
}

/** Primary: ip-api.com — free (no key, ~45 req/min), generally more accurate city-level
 *  data with explicit mobile/proxy/hosting flags. Free tier is HTTP-only, which is fine
 *  for a server→server fetch (no browser mixed-content). */
async function lookupIpApi(ip: string): Promise<GeoInfo | undefined> {
  const d = (await timedFetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp,mobile,proxy,hosting`)) as
    | { status?: string; country?: string; regionName?: string; city?: string; isp?: string; mobile?: boolean; proxy?: boolean; hosting?: boolean }
    | undefined;
  if (!d || d.status !== "success") return undefined;
  const isp = (d.isp || "").trim();
  const geo: GeoInfo = { country: d.country || "", region: d.regionName || "", city: d.city || "", isp, proxy: !!(d.proxy || d.hosting) || (!!isp && PROXY_HINT.test(isp)), at: new Date().toISOString() };
  return geo.country || geo.city ? geo : undefined;
}

/** Secondary: ipwho.is — free, HTTPS, no key, includes ISP (used for the proxy hint). */
async function lookupIpwho(ip: string): Promise<GeoInfo | undefined> {
  const d = (await timedFetch(`https://ipwho.is/${encodeURIComponent(ip)}`)) as
    | { success?: boolean; country?: string; region?: string; city?: string; connection?: { isp?: string; org?: string } }
    | undefined;
  if (!d || d.success === false) return undefined;
  const isp = (d.connection?.isp || d.connection?.org || "").trim();
  const geo: GeoInfo = { country: d.country || "", region: d.region || "", city: d.city || "", isp, proxy: !!isp && PROXY_HINT.test(isp), at: new Date().toISOString() };
  return geo.country || geo.city ? geo : undefined;
}

/** Fallback: freeipapi.com — free, HTTPS, no key. City/region/country only. */
async function lookupFreeIpApi(ip: string): Promise<GeoInfo | undefined> {
  const d = (await timedFetch(`https://freeipapi.com/api/json/${encodeURIComponent(ip)}`)) as
    | { countryName?: string; regionName?: string; cityName?: string }
    | undefined;
  if (!d) return undefined;
  const country = (d.countryName || "").trim(), region = (d.regionName || "").trim(), city = (d.cityName || "").trim();
  if (!country && !region && !city) return undefined;
  return { country, region, city, isp: "", proxy: false, at: new Date().toISOString() };
}

/** "City, Region, Country" from a GeoInfo (skips blanks). */
export function geoLabel(g?: GeoInfo | null): string {
  if (!g) return "";
  return [g.city, g.region, g.country].filter(Boolean).join(", ");
}

/** Resolve a whole batch of IPs → "City, Region, Country" labels at once, with two
 *  guards for the "cold cache, many rows" case (e.g. an admin list of hundreds of
 *  users): DE-DUPLICATE by IP (shared office/mobile IPs are looked up once) and cap
 *  concurrency (default 8) so we never fire hundreds of simultaneous lookups and trip
 *  the free service's burst limits. Returns a Map keyed by the TRIMMED ip; only IPs
 *  that resolved to a non-empty label are present. */
export async function geoLabelMany(ips: (string | null | undefined)[], limit = 8): Promise<Map<string, string>> {
  const uniq = [...new Set(ips.map((x) => (x || "").trim()).filter(Boolean))];
  const out = new Map<string, string>();
  for (let i = 0; i < uniq.length; i += limit) {
    await Promise.all(uniq.slice(i, i + limit).map(async (ip) => {
      const loc = geoLabel(await geoLookup(ip));
      if (loc) out.set(ip, loc);
    }));
  }
  return out;
}
