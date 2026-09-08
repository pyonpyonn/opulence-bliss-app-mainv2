import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { blogPosts, getBlogPost } from "@/lib/blogPosts";
import styles from "../../marketingPages.module.css";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return blogPosts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getBlogPost((await params).slug);
  if (!post) return {};
  return { title: `${post.title} | Opulence Bliss`, description: post.summary };
}

export default async function BlogPostPage({ params }: Props) {
  const post = getBlogPost((await params).slug);
  if (!post) notFound();

  return (
    <main className={styles.page}>
      <header className={`${styles.hero} ${styles.articleHero}`}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>{post.category}</p>
          <h1>{post.title}</h1>
          <div className={`${styles.meta} ${styles.articleMeta}`}>
            <time dateTime={post.publishedIso}>{post.published}</time>
            <span>{post.readTime}</span>
          </div>
        </div>
      </header>

      <div className={styles.articleShell}>
        <article className={styles.article}>
          {post.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.points && <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}
            </section>
          ))}
          <Link className={styles.backLink} href="/blog"><span aria-hidden="true">←</span> Back to all guides</Link>
        </article>
        <aside className={styles.aside}>
          <strong>Ready for a little help?</strong>
          <p>Choose a service, time and professional from the comfort of home.</p>
          <Link className={styles.primaryButton} href="/book">Book a visit</Link>
        </aside>
      </div>
      <SiteFooter />
    </main>
  );
}
