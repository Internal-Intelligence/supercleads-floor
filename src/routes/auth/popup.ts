import { createFileRoute } from "@tanstack/react-router";
import { handleAuthPopupRequest } from "@/lib/auth/popup.server";

export const Route = createFileRoute("/auth/popup")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthPopupRequest(request),
    },
  },
});
