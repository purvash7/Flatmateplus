import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "outline" },
  }
)

function Badge({ className, variant, style, ...props }) {
  const classes = String(className || "");
  const selectedPrimary = classes.includes("bg-primary");
  const selectedForeground = classes.includes("bg-foreground");
  const selectedAccent = classes.includes("bg-accent");
  const forcedColor = selectedPrimary
    ? "!text-primary-foreground"
    : selectedForeground
      ? "!text-background"
      : selectedAccent
        ? "!text-accent-foreground"
        : "!text-foreground";
  const forcedBg = selectedPrimary
    ? "!bg-primary !border-primary"
    : selectedForeground
      ? "!bg-foreground"
      : selectedAccent
        ? "!bg-accent !border-accent"
        : "";
  return <div className={cn(badgeVariants({ variant }), forcedColor, forcedBg, className)} style={style} {...props} />;
}

export { Badge, badgeVariants }
