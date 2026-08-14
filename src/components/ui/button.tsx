import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { haptic, type HapticKind } from "@/lib/floor/haptics";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg hover:bg-primary/90",
        board: "bg-board-ink text-board hover:bg-board-ink/90",
        secondary: "bg-raised text-fg hover:bg-raised/80",
        outline: "border border-border bg-transparent text-fg hover:bg-raised",
        ghost: "text-fg hover:bg-raised",
        danger: "bg-danger text-fg hover:bg-danger/90",
        ink: "border border-border bg-surface text-fg hover:bg-raised",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-5",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  haptic: hapticKind,
  onPointerDown,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    haptic?: HapticKind | false;
  }) {
  const Comp = asChild ? Slot : "button";
  const feel: HapticKind | false =
    hapticKind === undefined
      ? variant === "danger"
        ? "warn"
        : variant === "ghost"
          ? false
          : "tap"
      : hapticKind;
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      onPointerDown={(event) => {
        if (feel) haptic(feel);
        onPointerDown?.(event);
      }}
      {...props}
    />
  );
}
