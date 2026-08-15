import { toast as sonnerToast } from "sonner";

function toast({ title, description, variant }) {
  const message = title ?? "";
  const opts = description ? { description } : undefined;
  if (variant === "destructive") {
    return sonnerToast.error(message, opts);
  }
  return sonnerToast.success(message, opts);
}

export function useToast() {
  return { toast };
}

export { toast };
