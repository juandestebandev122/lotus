"use client";

import { useAuth } from "@/lib/auth";

export function Greeting() {
  const { user } = useAuth();
  const first = user?.fullName?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <p className="text-sm text-mist-400">
      {part}, <span className="font-semibold text-mist-100">{first}</span> 👋
    </p>
  );
}
