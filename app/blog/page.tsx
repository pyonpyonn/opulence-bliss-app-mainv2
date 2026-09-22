import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { blogPosts } from "@/lib/blogPosts";
import styles from "../marketingPages.module.css";

export const metadata: Metadata = {
  title: "Home care guides | Opulence Bliss",
  description: "Practical home-cleaning advice from Opulence Bliss.",
};

export default function BlogPage() {
  return (
    <main className={styles.page}>
      <header className={`${styles.hero} ${styles.blogHero}`}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Blog</p>
          <h1>Helpful ideas for a calmer home</h1>
          <p className={styles.heroIntro}>
            Straightforward guides for getting more from your cleaning visits.
          </p>
        </div>
      </header>

      <section className={styles.content} aria-label="Latest articles">
        <div className={`${styles.grid} ${styles.blogGrid}`}>
          {blogPosts.map((post) => (
            <article className={styles.card} key={post.slug}>
              <div className={`${styles.cardArt} ${styles[post.accent]}`} aria-hidden="true"><span className={styles.artMark}>{post.accent === "gold" ? "✓" : "✦"}</span></div>
              <div className={styles.cardBody}>
                <div className={styles.meta}>
                  <span className={styles.category}>{post.category}</span>
                  <time dateTime={post.publishedIso}>{post.published}</time>
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
