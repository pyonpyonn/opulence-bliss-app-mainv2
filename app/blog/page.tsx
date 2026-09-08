import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { blogPosts } from "@/lib/blogPosts";
import styles from "../marketingPages.module.css";

export const metadata: Metadata = {
  title: "Home care guides | Opulence Bliss",
  description: "Practical cleaning and at-home wellness advice from Opulence Bliss.",
};

export default function BlogPage() {
  const [featured, ...posts] = blogPosts;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>The Opulence Bliss journal</p>
          <h1>Helpful ideas for a calmer home</h1>
          <p className={styles.heroIntro}>
            Straightforward guides for getting more from your cleaning and wellness visits.
          </p>
        </div>
      </header>

      <section className={styles.content} aria-label="Latest articles">
        <article className={styles.featured}>
          <div className={styles.featureArt} aria-hidden="true"><span className={styles.artMark}>⌂</span></div>
          <div className={styles.featureCopy}>
            <div className={styles.meta}>
              <span className={styles.category}>{featured.category}</span>
              <time dateTime={featured.publishedIso}>{featured.published}</time>
              <span>{featured.readTime}</span>
            </div>
            <h2>{featured.title}</h2>
            <p>{featured.summary}</p>
            <Link className={styles.readLink} href={`/blog/${featured.slug}`}>Read the guide <span aria-hidden="true">→</span></Link>
          </div>
        </article>

        <div className={styles.grid}>
          {posts.map((post) => (
            <article className={styles.card} key={post.slug}>
              <div className={`${styles.cardArt} ${styles[post.accent]}`} aria-hidden="true"><span className={styles.artMark}>{post.accent === "gold" ? "✓" : "✦"}</span></div>
              <div className={styles.cardBody}>
                <div className={styles.meta}>
                  <span className={styles.category}>{post.category}</span>
                  <span>{post.readTime}</span>
                </div>
                <h2>{post.title}</h2>
                <p>{post.summary}</p>
                <Link className={styles.readLink} href={`/blog/${post.slug}`}>Read the guide <span aria-hidden="true">→</span></Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
