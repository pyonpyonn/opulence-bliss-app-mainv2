import type { Metadata } from "next";
import Link from "next/link";
import { COMING_SOON } from "@/lib/comingSoon";
import ServicePoll from "@/components/ServicePoll";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Coming soon | Opulence Bliss",
  description:
    "The services we are building next, from home maintenance to garden, pet and technology help. Tell us which one you want first.",
};

export default function ComingSoonPage() {
  return (
    <main className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Coming soon</p>
        <h1>More than cleaning, soon</h1>
        <p className={styles.lede}>
          Cleaning is live today. These are the services we are building next.
          Nothing here is bookable yet, so tell us which one you want first and
          we will start with that.
        </p>
        <Link href="/services/cleaning" className={styles.liveLink}>
          Book cleaning, available now →
        </Link>
      </header>

      <div className={styles.grid}>
        {COMING_SOON.map((service) => (
          <section
            key={service.key}
            id={service.slug}
            className={styles.card}
            aria-labelledby={`${service.slug}-title`}
          >
            <h2 id={`${service.slug}-title`}>{service.title}</h2>
            <p className={styles.detail}>{service.detail}</p>
            {service.items.length > 0 ? (
              <ul className={styles.items}>
                {service.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.tbc}>Full task list to be confirmed.</p>
            )}
          </section>
        ))}
      </div>

      <section className={styles.pollSection} aria-label="Service poll">
        <ServicePoll variant="page" />
      </section>
    </main>
  );
}
