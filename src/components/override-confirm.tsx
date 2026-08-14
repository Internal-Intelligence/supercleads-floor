import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type OverrideDraft = {
  title: string;
  body: string;
  action: string;
  danger?: boolean;
  run: () => void;
};

export function OverrideConfirm({
  draft,
  busy,
  onClose,
}: {
  draft: OverrideDraft | null;
  busy?: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{draft?.title ?? "Override"}</DialogTitle>
          <DialogDescription>{draft?.body}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ink" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={draft?.danger ? "danger" : "default"}
            disabled={busy}
            onClick={() => draft?.run()}
          >
            {draft?.action ?? "Override"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
