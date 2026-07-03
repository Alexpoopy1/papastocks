"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/", label: "Home",
    icon: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" />
  },
  {
    href: "/markets", label: "Markets",
    icon: <path d="M3 20h18M5 20V9m4.5 11V4m4.5 16v-8m4.5 8V7" strokeLinecap="round" />
  },
  {
    href: "/picks", label: "Picks",
    icon: <path d="m12 2 2.6 6.2 6.7.5-5.1 4.4 1.6 6.6L12 16.2l-5.8 3.5 1.6-6.6-5.1-4.4 6.7-.5L12 2Z" />
  },
  {
    href: "/ai", label: "Buddy",
    icon: <path d="M12 3a7 7 0 0 1 7 7c0 2.4-1.2 4.4-3 5.7V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-3.3c-1.8-1.3-3-3.3-3-5.7a7 7 0 0 1 7-7Zm-2 15h4" strokeLinecap="round" />
  },
  {
    href: "/settings", label: "Settings",
    icon: <path d="M12 8.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Zm8-1-1.7-3-2.6.9a7.6 7.6 0 0 0-1.7-1L13.5 2h-3l-.5 2.4a7.6 7.6 0 0 0-1.7 1L5.7 4.5 4 7.5l2.1 1.6a7.7 7.7 0 0 0 0 2L4 12.7l1.7 3 2.6-.9a7.6 7.6 0 0 0 1.7 1l.5 2.4h3l.5-2.4a7.6 7.6 0 0 0 1.7-1l2.6.9 1.7-3-2.1-1.6a7.7 7.7 0 0 0 0-2L20 7.5Z" strokeLinejoin="round" />
  }
];

export default function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`tab ${active ? "active" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              {t.icon}
            </svg>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
