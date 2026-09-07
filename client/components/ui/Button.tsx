import Link from "next/link";
import { cx } from "@/lib/format";

type Variant = "solid" | "outline" | "quiet" | "light";

/** 44px minimum on every variant, so everything is reachable with a thumb. */
const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 px-6 text-meta transition-colors duration-200 ease-out-quiet disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none";

const VARIANTS: Record<Variant, string> = {
  solid: "bg-bottle text-stone hover:bg-bottle-deep",
  outline: "border border-ink text-ink hover:bg-stone-deep",
  // For use on a bottle-green ground.
  light: "bg-stone text-bottle hover:bg-white",
  quiet: "px-0 text-ink underline decoration-1 underline-offset-4 hover:decoration-2",
};

interface CommonProps {
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({
  variant = "solid",
  fullWidth = false,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(BASE, VARIANTS[variant], fullWidth && "w-full", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = CommonProps &
  Omit<React.ComponentProps<typeof Link>, "className" | "children">;

export function ButtonLink({
  variant = "solid",
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={cx(BASE, VARIANTS[variant], fullWidth && "w-full", className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
