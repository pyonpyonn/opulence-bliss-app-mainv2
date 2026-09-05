"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isCleaning } from "@/lib/cleaningBooking";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function CleaningMenu() {
  const [packages, setPackages] = useState<{ id: string; name: string; billing_type: string }[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void createClient().from("packages").select("id, name, service_type, billing_type").eq("active", true).order("price").then(({ data, error }) => {
      if (!active) return;
      setFailed(Boolean(error));
      setPackages((data ?? []).filter((pkg) => isCleaning(pkg.service_type)));
    });
    return () => { active = false; };
  }, []);
  return <DropdownMenu>
    <DropdownMenuTrigger style={{ display: "flex", alignItems: "center", gap: 5, padding: "14px 0", border: 0, background: "transparent", color: "#16202a", font: "inherit", fontWeight: 800, whiteSpace: "nowrap" }}>
      Cleaning <ChevronDown size={16} />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" style={{ minWidth: 250, maxWidth: "calc(100vw - 24px)" }}>
      <DropdownMenuItem asChild><Link href="/services/cleaning">Explore cleaning services</Link></DropdownMenuItem>
      {packages.map((pkg) => <DropdownMenuItem asChild key={pkg.id}>
        <Link href={pkg.billing_type === "per_visit" ? `/book?type=clean&service=${encodeURIComponent(pkg.id)}` : "/subscribe"}>{pkg.name}</Link>
      </DropdownMenuItem>)}
      {failed && <DropdownMenuItem disabled>Packages could not load. Try again shortly.</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
