import type { ButtonHTMLAttributes, ReactNode } from "react";

// Petite bibliothèque de primitives UI partagées (thème clair "sport vibrant").

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-black/5 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  secondary: "border border-black/10 bg-white text-zinc-800 hover:bg-zinc-50",
  ghost: "text-zinc-600 hover:bg-zinc-100",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

type BadgeTone = "neutral" | "emerald" | "amber" | "sky";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  emerald: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  sky: "bg-sky-100 text-sky-800",
};

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}
