"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { api, token } from "../lib/api";

interface Account {
  name: string;
  role: "farmer" | "facilitator" | "administrator";
}

const LINKS: Record<Account["role"], Array<{ href: string; label: string }>> = {
  farmer: [
    { href: "/dashboard", label: "Amasomo" },
    { href: "/talk", label: "Vugana na AI" },
    { href: "/phone", label: "Telefoni ntoya" },
  ],
  facilitator: [{ href: "/facilitator", label: "Amasomo y'umutoza" }],
  administrator: [{ href: "/admin", label: "Ubuyobozi" }],
};

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<Account | null>(null);

  useEffect(() => {
    if (!token()) {
      router.push("/");
      return;
    }
    api<Account>("/auth/me").then(setUser).catch(() => router.push("/"));
  }, [router]);

  const home = user ? LINKS[user.role][0].href : "/";

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-inner">
          <Link href={home} className="brand">
            <span className="mark">M</span>
            <span>
              <strong>MenyaMuhinzi</strong>
              <small>{user ? user.name : "Isomo ry'imboga"}</small>
            </span>
          </Link>
          <nav>
            {user && LINKS[user.role].map((link) => (
              <Link key={link.href} href={link.href} className={path.startsWith(link.href) ? "nav-on" : ""}>{link.label}</Link>
            ))}
            <button
              className="ghost"
              onClick={() => {
                localStorage.removeItem("mm-token");
                router.push("/");
              }}
            >
              Sohoka
            </button>
          </nav>
        </div>
      </header>
      <main className="shell">{children}</main>
    </div>
  );
}
