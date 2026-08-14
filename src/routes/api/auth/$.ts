import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Better Auth CSRF compares Origin to this app's host. The live preview is
 * embedded on grok.com / SuperC, so the browser sends that parent origin and
 * login dies with "Invalid origin". Stamp Origin to the request host so the
 * check always sees this app. Mutate in place — Node cannot clone the
 * TanStack Request with `new Request(request)`.
 */
function stampAppOrigin(request: Request): Request {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "127.0.0.1:8080")
    .split(",")[0]
    ?.trim();
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host.startsWith("127.") || host.startsWith("localhost") || host.startsWith("[::1]")
      ? "http"
      : "https");
  const origin = `${proto}://${host}`;
  try {
    request.headers.set("origin", origin);
    const referer = request.headers.get("referer");
    if (!referer || !referer.startsWith(origin)) {
      request.headers.set("referer", `${origin}/`);
    }
  } catch {
    /* headers immutable — trustedOrigins still accepts the raw Origin */
  }
  return request;
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(stampAppOrigin(request)),
      POST: ({ request }) => auth.handler(stampAppOrigin(request)),
    },
  },
});
