import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

async function handleAuth(request: Request): Promise<Response> {
  try {
    const res = await auth.handler(request);
    if (res.status < 500) return res;
    const text = await res.text().catch(() => "");
    return Response.json(
      { message: text || "Sign-in is down. Try email, or wait a moment." },
      { status: 500 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed";
    return Response.json({ message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
});
