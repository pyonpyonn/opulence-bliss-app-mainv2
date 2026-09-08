import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import styles from "../marketingPages.module.css";

export const metadata: Metadata = {
  title: "Frequently asked questions | Opulence Bliss",
  description: "Answers about booking, payments, visits and professionals at Opulence Bliss.",
};

const faqGroups: Array<{
  title: string;
  items: Array<[question: string, answer: string]>;
}> = [
  {
    title: "Booking a visit",
    items: [
      ["When can I book a cleaning visit?", "Cleaning visits can be booked for two to eight hours in 30-minute steps. Start times run from 7:00 am through 8:00 pm, subject to professional availability. Same-day bookings need at least two hours of notice."],
      ["How does the recommended duration work?", "Enter your property size during booking and we will suggest a suitable number of hours. You can still choose another available duration if your home needs more or less attention."],
      ["Can I request a professional I already know?", "Yes. After you complete a visit with a professional, you can request them on a future booking. The request depends on their availability and acceptance."],
      ["Can I add special instructions?", "Yes. Add access details and cleaning priorities before payment. Once a professional accepts, you can use the private booking chat for visit-related messages and photos."],
    ],
  },
  {
    title: "Payments and changes",
    items: [
      ["When will my card be charged?", "Your card is authorised when you book and charged after the visit is completed. If no professional accepts the booking, the authorisation is released and you pay nothing."],
      ["Can I leave a tip?", "Yes. After the visit you can enter the tip amount you choose. The tip is separate from the service total."],
      ["What is the cancellation policy?", "Cancel at least 48 hours before the booking for a full refund. Cancellations made from 24 hours up to 48 hours before the booking receive a 50% refund. Cancellations made less than 24 hours before the booking are non-refundable. If your card has only been authorised, the refundable part of the hold is released instead."],
      ["How do I change or cancel a booking?", "Open the booking in your customer account and choose Cancel booking. Before you confirm, the cancellation screen shows the refund or charge that applies at that moment. Rescheduling has its own availability and notice rules."],
      ["Will I receive a receipt or invoice?", "Yes. Once a completed visit is settled, its booking page provides the related invoice details and download option."],
    ],
  },
  {
    title: "During your visit",
    items: [
      ["How will I know when the visit starts and finishes?", "The professional checks in and out through their portal. During the visit, your booking shows progress and the remaining time based on the duration you selected."],
      ["Will I receive reminders?", "We schedule reminders 24 hours and 90 minutes before the visit. In-app notifications also keep key booking updates in your account."],
      ["Can I send photos or files to my professional?", "Yes. The booking chat supports text, JPG, PNG, WebP and PDF files up to 10 MB, so you can share useful visit details securely."],
      ["Are professionals vetted?", "Professionals on Opulence Bliss are reviewed before offering services. The website displays their profile and customer rating to help you choose confidently."],
    ],
  },
  {
    title: "Memberships and professionals",
    items: [
      ["Do I need a membership to book?", "No. You can book a single visit whenever you need one. Memberships are available for customers who prefer regular scheduled care."],
      ["How do I join as a professional?", "Apply through the professional registration page. You will be asked for your service details and the information needed for account review."],
    ],
  },
];

export default function FaqPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Help centre</p>
          <h1>Questions, answered clearly</h1>
          <p className={styles.heroIntro}>Everything you need to know before, during and after an Opulence Bliss visit.</p>
        </div>
      </header>

      <section className={`${styles.content} ${styles.faqContent}`} aria-label="Frequently asked questions">
        {faqGroups.map((group) => (
          <section className={styles.faqGroup} key={group.title}>
            <h2>{group.title}</h2>
            {group.items.map(([question, answer]) => (
              <details className={styles.faqItem} key={question}>
                <summary>{question}</summary>
                <div className={styles.faqAnswer}><p>{answer}</p></div>
              </details>
            ))}
          </section>
        ))}

        <section className={styles.cta}>
          <div>
            <h2>Ready to arrange your visit?</h2>
            <p>See available services and times in your area.</p>
          </div>
          <div className={styles.ctaActions}>
            <Link className={styles.primaryButton} href="/book">Book a service</Link>
            <Link className={styles.secondaryButton} href="/provider/join">Work with us</Link>
          </div>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}
