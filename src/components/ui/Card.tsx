import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  hover,
  ...props
}: { hover?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-xl",
        hover && "transition-colors duration-150 hover:border-white/15 hover:bg-ink-800",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  action,
  icon,
}: {
  title: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}
