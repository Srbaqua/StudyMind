"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Upload" },
  { href: "/chat", label: "Chat" },
  { href: "/graph", label: "Knowledge Graph" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-8">
      <span className="text-white font-semibold text-lg">🧠 StudyMind</span>
      <div className="flex gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === l.href
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
