import { Outlet, createFileRoute } from "@tanstack/react-router";
import { FloorGate } from "@/components/gate";

export const Route = createFileRoute("/crm")({
  component: () => <FloorGate>{() => <Outlet />}</FloorGate>,
});
