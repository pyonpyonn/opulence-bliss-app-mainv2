export type BlogSection = {
  heading: string;
  paragraphs: string[];
  points?: string[];
};

export type BlogPost = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  published: string;
  publishedIso: string;
  readTime: string;
  accent: "purple" | "gold" | "pink";
  sections: BlogSection[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "how-many-cleaning-hours-do-i-need",
    category: "Cleaning guide",
    title: "How many cleaning hours does your home need?",
    summary:
      "A practical room-by-room guide to choosing enough time for a calm, thorough visit.",
    published: "8 September 2026",
    publishedIso: "2026-09-08",
    readTime: "4 min read",
    accent: "purple",
    sections: [
      {
        heading: "Start with the size of your home",
        paragraphs: [
          "When you book a cleaning visit, enter your property size and we will suggest a duration. It is a useful starting point, especially for a first visit, but the condition of the home and your priorities matter too.",
          "Our cleaning visits run from two to eight hours in 30-minute steps, so you can choose a clear finish time without guessing at odd intervals.",
        ],
      },
      {
        heading: "Allow more time for the first clean",
        paragraphs: [
          "A first visit often needs longer because your professional is learning the layout and bringing the home up to the standard you want. Kitchens, bathrooms, pet hair and built-up dust can all add time.",
        ],
        points: [
          "Add time when several bathrooms need a deep clean.",
          "Mention pet hair, heavy limescale or areas that need extra attention.",
          "Choose your must-do rooms if the whole list may not fit into one visit.",
        ],
      },
      {
        heading: "Share your priorities before the visit",
        paragraphs: [
          "Use the special instructions box to explain what matters most. Once a professional accepts your booking, the booking chat also lets you send a message or photo. Clear priorities help them use the booked time well.",
          "For regular visits, you can adjust the duration as you learn what works for your home, and returning customers can request a professional they have worked with before.",
        ],
      },
    ],
  },
  {
    slug: "prepare-your-home-for-a-cleaner",
    category: "Before your visit",
    title: "Five simple ways to prepare for your cleaner",
    summary:
      "Small steps before the doorbell rings help your professional spend more time cleaning.",
    published: "8 September 2026",
    publishedIso: "2026-09-08",
    readTime: "3 min read",
    accent: "gold",
    sections: [
      {
        heading: "Make the booked time count",
        paragraphs: [
          "You do not need to clean before your cleaner arrives. A few minutes of preparation simply removes obstacles and makes your priorities obvious.",
        ],
        points: [
          "Put away loose clothes, toys and paperwork where possible.",
          "Leave clear access instructions, including entry codes or concierge details.",
          "Keep pets comfortable in a separate room if they may be anxious.",
          "Point out delicate surfaces or products that should not be used.",
          "List your top priorities in the booking instructions.",
        ],
      },
      {
        heading: "Use the booking chat",
        paragraphs: [
          "After your booking is matched, you can message your professional directly about arrival details or send a photo of an area that needs attention. Keep the conversation focused on the visit so the useful details are easy to find.",
        ],
      },
      {
        heading: "Check in after the visit",
        paragraphs: [
          "Your feedback helps your professional understand your preferences next time. If you enjoyed the visit, your account makes it easy to request the same person again when they are available.",
        ],
      },
    ],
  },
  {
    slug: "benefits-of-massage-at-home",
    category: "Wellness at home",
    title: "Why an at-home massage makes relaxation last longer",
    summary:
      "Skip the return journey and turn your own space into a quiet place to reset.",
    published: "8 September 2026",
    publishedIso: "2026-09-08",
    readTime: "3 min read",
    accent: "pink",
    sections: [
      {
        heading: "Comfort before and after",
        paragraphs: [
          "An at-home appointment removes the travel, waiting room and journey home. You choose a familiar room, your therapist brings what they need, and you can rest as soon as the session finishes.",
        ],
      },
      {
        heading: "Create a calm setup",
        paragraphs: [
          "Choose a warm room with enough clear floor space for the therapist to work safely. Silence notifications, lower the lights and keep a glass of water nearby. Let the therapist know about injuries, sensitivities or pressure preferences before the session begins.",
        ],
        points: [
          "Wear comfortable clothes before and after the appointment.",
          "Avoid a heavy meal immediately beforehand.",
          "Allow a few quiet minutes after the therapist leaves.",
        ],
      },
      {
        heading: "Build it into your routine",
        paragraphs: [
          "A home appointment can fit around work and family life more easily than a trip across London. If regular visits suit you, memberships help put them on a predictable schedule.",
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
