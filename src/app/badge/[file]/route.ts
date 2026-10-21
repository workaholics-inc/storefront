import type { NextRequest } from "next/server";
import { clientIpFrom, createPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { serverEnv } from "@/lib/env";
import { LIMITS } from "@/lib/validation";
import en from "../../../../messages/en.json";
import fa from "../../../../messages/fa.json";

type PublicProject = components["schemas"]["PublicProject"];
type Lang = "fa" | "en";

const BADGE_TIMEOUT_MS = 5000;

const TEXT: Record<Lang, string> = { fa: fa.Badge.text, en: en.Badge.text };
const WIDTH: Record<Lang, number> = { fa: 212, en: 240 };
const HEIGHT = 28;

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

// One static image serves every public project: no name, no slug, no number.
function badge(lang: Lang): string {
  const text = escapeXml(TEXT[lang]);
  const width = WIDTH[lang];

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}" role="img" aria-label="${text}" xml:lang="${lang}">` +
    `<title>${text}</title>` +
    `<rect width="${width}" height="${HEIGHT}" rx="4" fill="#e3effa"/>` +
    `<text x="${width / 2}" y="18.5" text-anchor="middle" direction="${lang === "fa" ? "rtl" : "ltr"}" fill="#0f64a6" font-family="Vazirmatn, Tahoma, 'Segoe UI', Arial, sans-serif" font-size="13" font-weight="600" textLength="${width - 24}" lengthAdjust="spacingAndGlyphs">${text}</text>` +
    `</svg>`
  );
}

// An answer that is not the image is never cached, so a project made public
// later shows its badge at once and no failure sticks.
function empty(status: 404 | 503): Response {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

// The badge an owner of a public project puts on their own site: served from
// here, so no browser calls the platform. A members-only project and a missing
// one both answer 404, so the badge reveals nothing.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params;
  const name = file.toLowerCase();
  if (!name.endsWith(".svg")) return empty(404);
  const slug = name.slice(0, -".svg".length);
  if (!LIMITS.slugPattern.test(slug)) return empty(404);

  const lang: Lang = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "fa";

  // The storefront key only, never a session: the answer is the same for everyone.
  const result = await platformCall<PublicProject>(async () => {
    const env = serverEnv();
    const client = createPlatformClient({
      baseUrl: env.platformUrl,
      storefrontKey: env.storefrontApiKey,
      clientIp: clientIpFrom(request.headers),
    });

    return client.GET("/v1/public/projects/{slug}", {
      params: { path: { slug } },
      signal: AbortSignal.timeout(BADGE_TIMEOUT_MS),
    });
  });
  if (!result.ok) {
    return result.status === 404 || result.status === 400 ? empty(404) : empty(503);
  }

  return new Response(badge(lang), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
