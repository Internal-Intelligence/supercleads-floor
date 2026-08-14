import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

async function handleAuth(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "POST" && path.includes("sign-up/email")) {
    try {
      const body = (await request.json()) as {
        email?: string;
        password?: string;
        name?: string;
      };
      return await auth.api.signUpEmail({
        body: {
          email: String(body.email ?? ""),
          password: String(body.password ?? ""),
          name: String(body.name || body.email || "Rep"),
        },
        headers: request.headers,
        asResponse: true,
      });
    } catch (err) {
      return Response.json(
        { message: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  if (request.method === "POST" && path.includes("sign-in/email")) {
    try {
      const body = (await request.json()) as { email?: string; password?: string };
      return await auth.api.signInEmail({
        body: {
          email: String(body.email ?? ""),
          password: String(body.password ?? ""),
        },
        headers: request.headers,
        asResponse: true,
      });
    } catch (err) {
      return Response.json(
        { message: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  try {
    const res = await auth.handler(request);
    if (res.status < 500) return res;
    const text = await res.text().catch(() => "");
    return Response.json(
      { message: text || `Auth failed (${res.status})` },
      { status: 500 },
    );
  } catch (err) {
    return Response.json(
      { message: err instanceof Error ? err.message : "Sign-in failed" },
      { status: 500 },
    );
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
