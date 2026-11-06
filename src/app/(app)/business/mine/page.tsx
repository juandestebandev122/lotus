"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetchBusinesses, deleteBusiness, STATUS_LABEL, type BusinessCard, type BizStatus } from "@/lib/business";
import { Building2, Plus, ArrowLeft, Users, Eye, Pencil, Trash2, ExternalLink, BadgeCheck, Lock } from "lucide-react";

const STATUS_TONE: Record<BizStatus, "green" | "gold" | "petal" | "neutral"> = {
  verified: "green", pending: "gold", rejected: "petal", suspended: "neutral",
};

export default function MyBusinessPage() {
  const { toast } = useToast();
  const [mine, setMine] = useState<BusinessCard[] | null>(null);
  const [confirmDel, setConfirmDel] = useState<BusinessCard | null>(null);

  const reload = () => fetchBusinesses().then((s) => setMine(s.mine));
  useEffect(() => { reload(); }, []);

  if (!mine) return <div className="grid min-h-[60vh] place-items-center text-mist-400">Loading…</div>;

  const doDelete = async () => {
    if (!confirmDel) return;
    const b = confirmDel;
    setConfirmDel(null);
    const res = await deleteBusiness(b.id);
    if (res.ok) { toast(`Deleted "${b.name}"`, "success"); reload(); }
    else toast(res.error ?? "Could not delete", "error");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ButtonLink href="/business" variant="ghost" size="sm"><ArrowLeft className="size-4" /> Businesses</ButtonLink>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-mist-100"><Building2 className="size-6 text-lotus-300" /> My Business</h1>
          <p className="mt-0.5 text-sm text-mist-400">Manage your business accounts and track their reach.</p>
        </div>
        <ButtonLink href="/business/new" size="sm"><Plus className="size-4" /> Register</ButtonLink>
      </div>

      {mine.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="mx-auto size-9 text-mist-500" />
          <p className="mt-3 text-sm text-mist-300">You haven&apos;t registered a business yet.</p>
          <p className="text-xs text-mist-500">Create an official business account and get the verified badge.</p>
          <ButtonLink href="/business/new" size="sm" className="mt-4"><Plus className="size-4" /> Register your business</ButtonLink>
        </Card>
      ) : (
        <div className="space-y-3">
          {mine.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex gap-3">
                <Avatar name={b.name} src={b.logoUrl || undefined} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-mist-100">{b.name}</span>
                    {b.verified && <BadgeCheck className="size-4 text-sky-400" />}
                    <Badge tone={STATUS_TONE[b.status]} className="text-[10px]">{STATUS_LABEL[b.status]}</Badge>
                    {b.visibility === "businesses" && <span className="flex items-center gap-0.5 text-[10px] text-mist-500"><Lock className="size-2.5" /> Businesses only</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-mist-500">{b.category}</p>
                  {b.status === "rejected" && b.note && <p className="mt-1 text-xs text-rose-300">Reason: {b.note}</p>}
                  <div className="mt-2 flex gap-4 text-xs text-mist-400">
                    <span className="flex items-center gap-1"><Users className="size-3.5 text-lotus-300" /> {b.followers} followers</span>
                    <span className="flex items-center gap-1"><Eye className="size-3.5 text-lotus-300" /> {b.views} views</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <ButtonLink href={`/business/${b.id}`} size="sm" variant="secondary"><ExternalLink className="size-4" /> View</ButtonLink>
                <ButtonLink href={`/business/new?id=${b.id}`} size="sm" variant="outline"><Pencil className="size-4" /> Edit</ButtonLink>
                <Button size="sm" variant="ghost" className="!text-rose-300 hover:!bg-rose-500/10" onClick={() => setConfirmDel(b)}><Trash2 className="size-4" /> Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          title="Delete business?"
          message={`"${confirmDel.name}" and its followers will be permanently removed. This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
