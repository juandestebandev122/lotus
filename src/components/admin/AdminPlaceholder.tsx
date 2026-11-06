import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Sparkles } from "lucide-react";

export function AdminPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card className="grid min-h-[60vh] place-items-center p-10 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-lg bg-lotus-500/12 text-lotus-300">
          <Icon className="size-7" />
        </span>
        <div className="mt-4 flex justify-center">
          <Badge tone="gold">
            <Sparkles className="size-3" /> Coming soon
          </Badge>
        </div>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-mist-100">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-mist-400">{description}</p>
      </div>
    </Card>
  );
}
