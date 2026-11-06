"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { fileToDataUrl } from "@/lib/image";
import { withBase } from "@/lib/base-path";
import { useConfig } from "@/lib/config";
import { PhotoEditor } from "@/components/PhotoEditor";
import { usePhotoEdit } from "@/components/usePhotoEdit";
import { ArrowLeft, Camera, ImagePlus, Trash2, RotateCcw } from "lucide-react";

export default function EditProfilePage() {
  const { user, updateUser } = useAuth();
  const { config } = useConfig();
  const pe = config.photoEditor ?? {};
  const { toast } = useToast();
  const router = useRouter();
  const [editorFile, setEditorFile] = useState<File | null>(null);
  const [prevAvatar, setPrevAvatar] = useState("");
  const { pick: coverEdit, editor: coverEditor } = usePhotoEdit({ aspect: "cover" });

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [gender, setGender] = useState(user?.gender ?? "male");
  const [city, setCity] = useState(user?.city ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [cover, setCover] = useState(user?.cover ?? "");
  const [busy, setBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  if (!user) return null;

  /**
   * The REAL bytes of the picture currently on screen, as a data: URL.
   *
   * `user.avatar` is a cacheable LINK ("/api/avatar/<id>?v=…"), not image data —
   * so remembering it for "Restore" only remembered a link, and restoring sent
   * that link back as if it were a photo. Fetching the bytes here is what makes
   * Restore actually put the old picture back. Returns "" if it can't be read,
   * and the Restore button then stays hidden rather than pretending to work.
   */
  const snapshotCurrentAvatar = async (): Promise<string> => {
    const cur = (avatar || user?.avatar || "").trim();
    if (!cur) return "";
    if (cur.startsWith("data:image/")) return cur; // already real bytes
    try {
      const res = await fetch(withBase(cur), { credentials: "include" });
      if (!res.ok) return "";
      const blob = await res.blob();
      if (!blob.size || !blob.type.startsWith("image/")) return "";
      return await new Promise<string>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : "");
        fr.onerror = () => resolve("");
        fr.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  };

  // Remove the current photo → fall through to the app-wide default avatar
  // (admin picture and/or the member's name — see /admin/photo-editor). We clear
  // the field rather than COPYING the default picture into it, so a later change
  // to the house default reaches everyone who has no photo.
  const removeAvatar = async () => {
    setPrevAvatar(await snapshotCurrentAvatar());
    setAvatar("");
    updateUser({ avatar: "" });
    toast("Photo removed", "info");
  };

  const pickAvatar = async (file?: File) => {
    if (!file) return;
    // Validate against the admin's Photo Editor limits (format + size).
    const formats = pe.formats ?? ["jpg", "png", "webp"];
    const ext = (file.name.split(".").pop() || "").toLowerCase().replace("jpeg", "jpg");
    const typeOk = formats.some((f) => f === ext) || /^image\//.test(file.type);
    if (!typeOk) { toast(`Please choose a ${formats.map((f) => f.toUpperCase()).join(" / ")} image.`, "error"); return; }
    const maxMB = pe.maxSizeMB ?? 10;
    if (file.size > maxMB * 1024 * 1024) { toast(`Image is too large (max ${maxMB} MB).`, "error"); return; }
    // Open the full editor when it's enabled; otherwise fall back to a plain resize.
    if (pe.enabled !== false) { setEditorFile(file); return; }
    try {
      const url = await fileToDataUrl(file, pe.maxRes ?? 256, (pe.quality ?? 72) / 100);
      applyAvatar(url);
    } catch {
      toast("Could not read that image", "error");
    }
  };

  // Apply an edited avatar — straight away, or into the admin-approval queue.
  const applyAvatar = async (url: string) => {
    // Keep the REAL previous image (not the link to it) so "Restore" can put it back.
    setPrevAvatar(await snapshotCurrentAvatar());
    if (pe.approvalRequired) {
      try {
        const res = await fetch(withBase("/api/me/avatar"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatar: url, forApproval: true }) });
        if (res.ok) toast("Photo sent for admin approval — it'll appear once approved.", "success");
        else toast("Could not submit the photo", "error");
      } catch { toast("Could not submit the photo", "error"); }
      return;
    }
    setAvatar(url);
    updateUser({ avatar: url }); // persist + updates instantly across the app (my own view)
    toast("Profile photo updated", "success");
  };

  const restoreAvatar = () => {
    if (!prevAvatar) return;
    setAvatar(prevAvatar);
    updateUser({ avatar: prevAvatar });
    setPrevAvatar("");
    toast("Previous photo restored", "success");
  };

  // Cover now goes through the SAME advanced editor (crop/zoom/rotate) as the avatar.
  const pickCover = (file?: File) => {
    coverEdit(file, (url) => { setCover(url); updateUser({ cover: url }); toast("Cover image updated", "success"); });
  };

  const removeCover = () => { setCover(""); updateUser({ cover: "" }); toast("Cover image removed", "info"); };

  function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Only send a picture when it is REAL IMAGE DATA the user just picked, or an
    // explicit "" to clear it.
    //
    // `user.avatar` arrives from the server as a cacheable LINK
    // ("/api/avatar/<id>?v=…"), and this form seeds its state from it. Sending
    // that link back used to overwrite the stored image with a URL pointing at
    // itself, so the photo vanished the first time anyone saved their profile.
    // The server now refuses it too — this just stops us asking.
    const sendable = (v: string) =>
      v === "" || v.startsWith("data:image/") || (v.startsWith("/") && !v.startsWith("/api/avatar/"));
    updateUser({
      fullName: fullName.trim() || user!.fullName,
      username: username.trim() || user!.username,
      bio,
      gender: gender as "male" | "female" | "other",
      city,
      ...(sendable(avatar) ? { avatar } : {}),
      ...(sendable(cover) ? { cover } : {}),
    });
    setTimeout(() => {
      setBusy(false);
      toast("Profile updated successfully ✨", "success");
      router.push("/profile");
    }, 500);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/profile" className="mb-4 inline-flex items-center gap-2 text-sm text-mist-400 hover:text-mist-100">
        <ArrowLeft className="size-4" /> Back to profile
      </Link>

      <Card className="p-6 sm:p-8">
        <h1 className="font-display text-xl font-bold text-mist-100">Edit profile</h1>
        <p className="mt-1 text-sm text-mist-400">Update your information and how others see you.</p>

        {/* Cover image */}
        <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="mt-6">
          <div className="relative h-36 overflow-hidden rounded-2xl border border-white/10 sm:h-44">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.startsWith("data:") ? cover : withBase(cover)} alt="Cover" className="size-full object-cover" />
            ) : (
              <div className="size-full bg-gradient-to-br from-lotus-700/50 via-[#241b46]/70 to-ink-900" />
            )}
            <div className="absolute bottom-2 right-2 flex gap-2">
              <Button type="button" size="sm" onClick={() => coverInput.current?.click()}>
                <ImagePlus className="size-4" /> {cover ? "Change cover" : "Add cover"}
              </Button>
              {cover && (
                <Button type="button" size="sm" variant="secondary" onClick={removeCover}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-mist-400">Cover image shown at the top of your profile. PNG or JPG.</p>
        </div>

        {/* Avatar */}
        <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => { pickAvatar(e.target.files?.[0]); e.target.value = ""; }} />
        {/* Dedicated CAMERA capture — `capture` tells a phone to open the camera directly. */}
        <input ref={cameraInput} type="file" accept="image/*" capture="user" hidden onChange={(e) => { pickAvatar(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="mt-6 flex items-center gap-4">
          <div className="relative">
            <Avatar name={fullName || user.fullName} src={avatar || user.avatar} size="xl" />
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-lotus-600 text-white ring-2 ring-ink-900"
              aria-label="Change profile photo"
            >
              <Camera className="size-4" />
            </button>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-mist-100">Profile photo</div>
            <div className="text-xs text-mist-400">
              {(pe.formats ?? ["jpg", "png", "webp"]).map((f) => f.toUpperCase()).join(" / ")}{pe.enabled !== false ? " — crop, zoom, rotate & flip" : ""}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="secondary" onClick={() => cameraInput.current?.click()}>
                <Camera className="size-3.5" /> Camera
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => avatarInput.current?.click()}>
                <ImagePlus className="size-3.5" /> Gallery
              </Button>
              {(avatar || user.avatar) && (
                <Button type="button" size="sm" variant="secondary" onClick={removeAvatar}>
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              )}
              {prevAvatar && (
                <Button type="button" size="sm" variant="secondary" onClick={restoreAvatar}>
                  <RotateCcw className="size-3.5" /> Restore
                </Button>
              )}
            </div>
          </div>
        </div>

        {editorFile && (
          <PhotoEditor
            file={editorFile}
            config={pe}
            onCancel={() => setEditorFile(null)}
            onSave={(url) => { setEditorFile(null); applyAvatar(url); }}
          />
        )}
        {coverEditor}

        <form onSubmit={save} className="mt-7 space-y-4">
          <Field label="Full name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Username">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gender">
              <Select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Location">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, State" />
            </Field>
          </div>
          <Field label="Bio" hint={`${bio.length}/160`}>
            <Textarea
              value={bio}
              maxLength={160}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the community about yourself…"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/profile")}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
