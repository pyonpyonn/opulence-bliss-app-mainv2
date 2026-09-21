/**
 * The services we have not launched yet, used by both the header dropdown and
 * the /coming-soon page so the two can never drift apart.
 *
 * `key` is written to customer_service_interest.service_key by the poll and is
 * constrained in the database. Adding or renaming a key here requires a
 * matching migration; see 20260917000100_expand_customer_service_poll.sql.
 */
export type ComingSoonService = {
  key: ComingSoonKey;
  /** Anchor target on /coming-soon. */
  slug: string;
  title: string;
  /** One line, used under the title in the poll and on the page. */
  detail: string;
  items: string[];
};

export const COMING_SOON_KEYS = [
  "moving_support",
  "garden",
  "pets",
  "tech_help",
  "carpet_upholstery",
] as const;

export type ComingSoonKey = (typeof COMING_SOON_KEYS)[number];

export const COMING_SOON: ComingSoonService[] = [
  {
    key: "moving_support",
    slug: "home-organisation",
    title: "Home organisation/House movers",
    detail: "Decluttering, organising and hands-on help around a move.",
    items: [
      "Decluttering",
      "Wardrobe organisation",
      "Kitchen/cupboard organisation",
      "Move-in unpacking",
      "Moving-day preparation",
      "Moving support",
    ],
  },
  {
    key: "garden",
    slug: "garden-services",
    title: "Garden services",
    detail: "Keeping outdoor space tidy through the seasons.",
    items: [
      "Lawn mowing",
      "Hedge trimming",
      "Weeding",
      "Leaf clearance",
      "Patio/garden tidying",
      "Plant watering",
    ],
  },
  {
    key: "pets",
    slug: "pet-services",
    title: "Pet services",
    detail: "Care for your animals while you are out or away.",
    items: [
      "Dog walking",
      "Pet sitting",
      "Feeding pets while owners are away",
      "Pet taxi",
      "House sitting",
    ],
  },
  {
    key: "tech_help",
    slug: "technology-help",
    title: "Technology help for households",
    detail: "Setting up and troubleshooting the tech around your home.",
    items: [
      "Setting up Wi-Fi",
      "Smart TVs",
      "Printers",
      "Doorbells/cameras",
      "Alexa/Google Home",
      "Phones/tablets",
      "Basic computer help",
    ],
  },
  {
    key: "carpet_upholstery",
    slug: "carpet-upholstery",
    title: "Carpet & Upholstery cleaning",
    detail: "Deep cleaning for carpets, rugs and soft furnishings.",
    // No task list supplied yet; the UI renders the card without a list.
    items: [],
  },
];

export function comingSoonByKey(key: string): ComingSoonService | undefined {
  return COMING_SOON.find((service) => service.key === key);
}
