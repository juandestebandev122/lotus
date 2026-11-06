"use client";

// A small, fast emoji picker. Deliberately self-contained: no external emoji
// library and no network call, so it works offline and cannot be blocked.

import { useState } from "react";
import { cn } from "@/lib/cn";

const GROUPS: { name: string; icon: string; list: string[] }[] = [
  {
    name: "Smileys", icon: "😀",
    list: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😮 😯 😴 🥱 😪 😌 😔 😕 🙁 ☹️ 😖 😞 😟 😤 😢 😭 😦 😨 😰 😥 😓 🤯 😳 🥵 🥶 😱 😵 🤬 😡 😠 🤢 🤮 🤧 😷 🤒 🤕 🥳 🥺 😈 👿 💀 👻 🤡".split(" "),
  },
  {
    name: "Gestures", icon: "👍",
    list: "👍 👎 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 💪 🦾 👀 👁️ 💅".split(" "),
  },
  {
    name: "Hearts", icon: "❤️",
    list: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✨ 💫 ⭐ 🌟 💥 🔥 💯".split(" "),
  },
  {
    name: "Fun", icon: "🎉",
    list: "🎉 🎊 🎁 🎂 🍰 🥳 🎈 🎀 🏆 🥇 🥈 🥉 ⚽ 🏀 🎮 🎲 🎯 🎧 🎵 🎶 🎤 🌹 🌸 🌺 🌻 🌷 💐 🍀 ☀️ 🌙 ⛅ 🌈 ☕ 🍕 🍔 🍟 🍦 🍩 🍫 🥤".split(" "),
  },
];

export function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState(0);
  return (
    <div className="absolute bottom-full left-0 z-30 mb-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-ink-850 p-2 shadow-2xl">
      <div className="mb-1.5 flex gap-1">
        {GROUPS.map((g, i) => (
          <button
            key={g.name}
            onClick={() => setTab(i)}
            title={g.name}
            className={cn("flex-1 rounded-lg py-1.5 text-lg transition", i === tab ? "bg-lotus-500/20" : "hover:bg-white/[0.06]")}
          >
            {g.icon}
          </button>
        ))}
        <button onClick={onClose} title="Close" className="rounded-lg px-2 text-sm text-mist-400 hover:bg-white/[0.06] hover:text-mist-100">✕</button>
      </div>
      <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto">
        {GROUPS[tab].list.map((e, i) => (
          <button
            key={`${e}-${i}`}
            onClick={() => onPick(e)}
            className="rounded-lg py-1 text-xl transition hover:bg-white/[0.08]"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
