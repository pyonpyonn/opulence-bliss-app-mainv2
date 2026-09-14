"use client";

// SETUP: code "components/SiteHeader.tsx"
//
// Inline styles on purpose — nothing in globals.css can override them.

import CleaningMenu from "@/components/CleaningMenu";
import ComingSoonMenu from "@/components/ComingSoonMenu";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Menu, X } from "lucide-react";

const supabase = createClient();

const CORAL = "#6D28D9";
const GRAD = "linear-gradient(100deg,#F5C542,#C86FC9 55%,#7B2FF7)";
const INK = "#16202A";

type NavLink = { href: string; label: string; match: string[] };

// The same links for everyone, signed in or not. Anything role-specific
// lives inside the portal, reached via "My account".
const NAV: NavLink[] = [
  { href: "/services/cleaning", label: "Cleaning", match: ["/services/cleaning"] },
  { href: "/providers", label: "Our pros", match: ["/providers"] },
  { href: "/provider/join", label: "Jobs", match: ["/provider"] },
];

export default function SiteHeader() {
  const path = usePathname() ?? "";
  const [role, setRole] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [mobileOpen]);

  useEffect(() => {
    let alive = true;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setRole(null);
        setUnread(0);
      } else {
        const { data: p } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (!alive) return;
        setRole(p?.role ?? "customer");

        const { count } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false);
        if (!alive) return;
        setUnread(count ?? 0);
      }
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    const timer = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  let active: string | null = null;
  let bestLen = -1;
  for (const l of NAV) {
    for (const m of l.match) {
      if (m && path.startsWith(m) && m.length > bestLen) {
        bestLen = m.length;
        active = l.href;
      }
    }
  }

  const accountHref =
    role === "provider"
      ? "/worker"
      : role === "admin"
        ? "/admin"
        : role
          ? "/account"
          : "/login";

  // The provider and admin portals have their own chrome.
  if (
    path.startsWith("/worker") ||
    path.startsWith("/admin") ||
    path.startsWith("/account")
  )
    return null;

  return (
    <header style={wrap}>
      {/* ---------- row 1 ---------- */}
      <div className="site-header-bar" style={bar}>
        <Link href="/" style={logo}>
          opulence<span style={{ color: CORAL }}>bliss</span>
        </Link>

        <div className="site-header-actions desktop-actions">
          <Link href="/blog" style={blogBtn}>
            Blog
          </Link>
          {!role && (
            <Link href="/provider/login" style={proBtn}>
              Sign in as a pro
            </Link>
          )}
          <Link
            href={accountHref}
            style={{ ...ghostBtn, position: "relative" }}
          >
            {role ? "My account" : "Log in"}
            {unread > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: GRAD,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 900,
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 0 0 2px #fff",
                }}
              >
                {unread}
              </span>
            )}
          </Link>
          <Link href="/book" style={cta}>
            Book now
          </Link>
        </div>

        <div className="mobile-primary">
          <Link href="/book" className="mobile-book">
            Book
          </Link>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-site-menu"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {/* ---------- row 2 ---------- */}
      <nav className="desktop-navigation" style={navRow} aria-label="Main">
        <div className="site-header-nav-inner" style={navInner}>
          {NAV.map((l) => {
            if (l.href === "/services/cleaning")
              return (
                <Fragment key={l.href}>
                  <CleaningMenu />
                  <ComingSoonMenu />
                </Fragment>
              );
            const on = active === l.href;
            const hot = hover === l.href;
            return (
              <Link
                key={l.href + l.label}
                href={l.href}
                prefetch
                onMouseEnter={() => setHover(l.href)}
                onMouseLeave={() => setHover(null)}
                style={{
                  ...navItem,
                  color: on || hot ? CORAL : INK,
                  borderBottom: "4px solid transparent",
                  borderImage: on ? `${GRAD} 1` : "none",
                  backgroundImage: on ? GRAD : "none",
                  backgroundSize: "100% 4px",
                  backgroundPosition: "bottom",
                  backgroundRepeat: "no-repeat",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {mobileOpen && (
        <div id="mobile-site-menu" className="mobile-menu">
          <nav aria-label="Mobile main navigation" className="mobile-links">
            <Link href="/services/cleaning">Cleaning</Link>
            <ComingSoonMenu />
            <Link href="/providers">Our pros</Link>
            <Link href="/provider/join">Jobs</Link>
            <Link href="/blog">Blog</Link>
          </nav>
          <div className="mobile-account-actions">
            {!role && <Link href="/provider/login">Sign in as a pro</Link>}
            <Link href={accountHref}>{role ? "My account" : "Client log in"}</Link>
          </div>
        </div>
      )}

      <style jsx>{`
        .site-header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .site-header-nav-inner {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .site-header-nav-inner::-webkit-scrollbar {
          display: none;
        }

        .mobile-primary,
        .mobile-menu {
          display: none;
        }

        @media (max-width: 700px) {
          .site-header-bar {
            min-height: 64px;
            gap: 8px !important;
            padding: 12px 14px !important;
          }

          .desktop-actions,
          .desktop-navigation {
            display: none !important;
          }

          .mobile-primary {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .mobile-book {
            display: inline-flex;
            align-items: center;
            min-height: 40px;
            padding: 8px 15px;
            border-radius: 999px;
            background: ${GRAD};
            color: #fff;
            box-shadow: 0 5px 14px rgba(109, 40, 217, 0.2);
            font-size: 13.5px;
            font-weight: 900;
            text-decoration: none;
            white-space: nowrap;
          }

          .mobile-menu-button {
            display: grid;
            place-items: center;
            width: 42px;
            height: 42px;
            padding: 0;
            border: 1px solid #e5e0eb;
            border-radius: 13px;
            background: #fff;
            color: ${INK};
            cursor: pointer;
          }

          .mobile-menu {
            display: grid;
            gap: 14px;
            padding: 10px 14px 16px;
            border-top: 1px solid #eee8f5;
            background: rgba(255, 255, 255, 0.98);
            box-shadow: 0 18px 34px rgba(22, 32, 42, 0.13);
          }

          .mobile-links {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .mobile-links :global(a),
          .mobile-links :global(button) {
            display: flex;
            align-items: center;
            min-width: 0;
            min-height: 44px;
            padding: 10px 12px !important;
            border: 1px solid #ece7f2 !important;
            border-radius: 12px !important;
            background: #faf8fd !important;
            color: ${INK} !important;
            font-family: inherit !important;
            font-size: 14px !important;
            font-weight: 850 !important;
            text-decoration: none;
          }

          .mobile-account-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            padding-top: 12px;
            border-top: 1px solid #eee8f5;
          }

          .mobile-account-actions a {
            display: grid;
            place-items: center;
            min-height: 44px;
            padding: 9px 12px;
            border: 1.5px solid #dccbfa;
            border-radius: 12px;
            color: ${CORAL};
            font-size: 13.5px;
            font-weight: 900;
            text-align: center;
            text-decoration: none;
          }
        }

        @media (max-width: 370px) {
          .mobile-book {
            padding-inline: 12px;
          }
          .mobile-account-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </header>
  );
}

/* ---------- styles ---------- */

const wrap: React.CSSProperties = {
  background: "#fff",
  position: "sticky",
  top: 0,
  zIndex: 40,
  fontFamily: "'Nunito', system-ui, sans-serif",
  boxShadow: "0 1px 0 rgba(22,32,42,0.06)",
};

const bar: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "18px 26px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const logo: React.CSSProperties = {
  fontFamily: "'Nunito', system-ui, sans-serif",
  fontSize: "clamp(26px, 4vw, 34px)",
  fontWeight: 900,
  lineHeight: 1,
  letterSpacing: "-0.035em",
  color: INK,
  textDecoration: "none",
};

const ghostBtn: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: INK,
  textDecoration: "none",
  padding: "10px 16px",
  borderRadius: 999,
  borderWidth: 2,
  borderStyle: "solid",
  borderColor: "#EDEDEF",
  whiteSpace: "nowrap",
};

const proBtn: React.CSSProperties = {
  ...ghostBtn,
  color: CORAL,
  borderColor: "#DCCBFA",
  background: "#FAF7FF",
};

const blogBtn: React.CSSProperties = {
  ...ghostBtn,
  background: "#fff",
};

const cta: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#fff",
  textDecoration: "none",
  padding: "12px 22px",
  borderRadius: 999,
  background: `linear-gradient(100deg,#F5C542,#C86FC9 55%,#7B2FF7)`,
  whiteSpace: "nowrap",
  boxShadow: "0 6px 16px rgba(109,40,217,0.26)",
};

const navRow: React.CSSProperties = {
  background: "#F8F3FF",
  borderTop: "1px solid #E8DCFA",
  borderBottom: "1px solid #E8DCFA",
};

const navInner: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "0 26px",
  display: "flex",
  gap: 30,
  overflowX: "auto",
  overflowY: "hidden",
};

const navItem: React.CSSProperties = {
  fontSize: 16.5,
  fontWeight: 800,
  textDecoration: "none",
  padding: "14px 0 11px",
  borderBottom: "4px solid transparent",
  marginBottom: -1,
  whiteSpace: "nowrap",
};
