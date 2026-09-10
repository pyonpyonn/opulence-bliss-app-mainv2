import Link from "next/link";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legal";
import styles from "./SiteFooter.module.css";

const columns: Array<{
  title: string;
  links: Array<[label: string, href: string]>;
}> = [
  {
    title: "Services",
    links: [
      ["Home cleaning", "/services/cleaning"],
      ["Massage at home", "/services/massage"],
      ["Memberships", "/subscribe"],
      ["Book a service", "/book"],
    ],
  },
  {
    title: "Explore",
    links: [
      ["Meet our professionals", "/providers"],
      ["How it works", "/#how"],
      ["Blog", "/blog"],
      ["Public reviews", "/reviews"],
      ["Frequently asked questions", "/faq"],
    ],
  },
  {
    title: "For professionals",
    links: [
      ["Work with us", "/provider/join"],
      ["Professional sign in", "/provider/login"],
      ["Customer sign in", "/login"],
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.inner}>
        <section className={styles.lead} aria-labelledby="footer-heading">
          <p className={styles.brand} id="footer-heading">
            opulence<span>bliss</span>
          </p>
          <p className={styles.promise}>
            Trusted home cleaning and wellness care, thoughtfully delivered
            across London.
          </p>
          <Link href="/book" className={styles.bookButton}>
            Book your visit <span aria-hidden="true">→</span>
          </Link>
          <p className={styles.coverage}>
            Central, North &amp; West London
          </p>
        </section>

        <nav className={styles.columns} aria-label="Footer navigation">
          {columns.map((column) => (
            <div className={styles.column} key={column.title}>
              <h2>{column.title}</h2>
              {column.links.map(([label, href]) => (
                <Link href={href} key={href}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className={styles.bottom}>
        <p>© {new Date().getFullYear()} Opulence Bliss. London, United Kingdom.</p>
        <div className={styles.legal}>
          {TERMS_URL && (
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
              Terms &amp; Conditions
            </a>
          )}
          {PRIVACY_URL && (
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
          )}
          <Link href="/faq">Help &amp; FAQ</Link>
        </div>
      </div>
    </footer>
  );
}
