import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-mist-300">{label}</span>
      )}
      {children}
      {hint && <span className="mt-1.5 block text-xs text-mist-500">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl bg-ink-800 border border-line text-mist-100 placeholder:text-mist-500 outline-none transition-all focus:border-lotus-400 focus:ring-2 focus:ring-lotus-500/25";

export function Input({
  className,
  icon,
  ...props
}: { icon?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  if (icon) {
    // Icon + input share ONE bordered box (flex), so the icon never looks like
    // a separate element floating in empty space.
    return (
      <div
        className={cn(
          "flex h-12 items-center gap-2 rounded-xl border border-line bg-ink-800 px-3.5 transition-all focus-within:border-lotus-400 focus-within:ring-2 focus-within:ring-lotus-500/25",
          className,
        )}
      >
        <span className="pointer-events-none shrink-0 text-mist-300 [&>svg]:size-[18px]">{icon}</span>
        <input
          className="h-full w-full bg-transparent text-mist-100 placeholder:text-mist-500 outline-none"
          {...props}
        />
      </div>
    );
  }
  return <input className={cn(inputBase, "h-12 px-4", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(inputBase, "min-h-24 resize-y px-4 py-3", className)} {...props} />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(inputBase, "h-12 appearance-none px-4 pr-10", className)}
      {...props}
    >
      {children}
    </select>
  );
}
