"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/chatbot", label: "Assistant", icon: "💬" },
  { href: "/matches", label: "Matchs", icon: "🎾" },
];

export default function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 rounded-xl bg-zinc-100 p-1">
      {tabs.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
