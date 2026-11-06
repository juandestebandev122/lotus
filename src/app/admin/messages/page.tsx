"use client";

import MessagesPage from "@/app/(app)/messages/page";

// Admin route wrapper for the main inbox UI.
// Keeps the same functionality while serving it at /admin/messages.
export default function AdminMessagesPage() {
  return <MessagesPage />;
}
