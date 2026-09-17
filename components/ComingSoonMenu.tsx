"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { COMING_SOON } from "@/lib/comingSoon";
import ServicePoll from "@/components/ServicePoll";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./ComingSoonMenu.module.css";

/**
 * Desktop header dropdown. Opens on hover with a pointer and on click
 * otherwise, matching CleaningMenu. The mobile drawer does not use this: it
 * links to /coming-soon instead, since a nested dropdown inside a drawer is
 * awkward on touch.
 */
export default function ComingSoonMenu() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function supportsHover() {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  function showOnHover() {
    if (!supportsHover()) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function hideAfterHover() {
    if (!supportsHover()) return;
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }

  function keepOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  const active = pathname.startsWith("/coming-soon");

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <span
        className={styles.triggerWrap}
        onMouseEnter={showOnHover}
        onMouseLeave={hideAfterHover}
      >
        <DropdownMenuTrigger
          asChild
          className={`${styles.trigger} ${active ? styles.active : ""}`}
        >
          <Link
            href="/coming-soon"
            aria-label="Services coming soon"
            onClick={() => setOpen(false)}
          >
            Coming soon
            <ChevronDown
              size={16}
              className={open ? styles.chevronOpen : styles.chevron}
            />
          </Link>
        </DropdownMenuTrigger>
      </span>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className={styles.menu}
        onMouseEnter={keepOpen}
        onMouseLeave={hideAfterHover}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className={styles.listWrap}>
          <span className={styles.listLabel}>In the works</span>
          <ul className={styles.list}>
            {COMING_SOON.map((service) => (
              <li key={service.key}>
                <Link
                  href={`/coming-soon#${service.slug}`}
                  className={styles.listItem}
                  onClick={() => setOpen(false)}
                >
                  <span className={styles.listText}>
                    <strong>{service.title}</strong>
                    {service.items.length > 0 && (
                      <small>
                        {service.items.slice(0, 3).join(" · ")}
                        {service.items.length > 3 &&
                          ` and ${service.items.length - 3} more`}
                      </small>
                    )}
                  </span>
                  <ArrowRight size={15} className={styles.listArrow} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.pollWrap}>
          <ServicePoll enabled={open} variant="compact" />
        </div>

        <Link
          href="/coming-soon"
          className={styles.allLink}
          onClick={() => setOpen(false)}
        >
          See everything coming soon
          <ArrowRight size={15} />
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
