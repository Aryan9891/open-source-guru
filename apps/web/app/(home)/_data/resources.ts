export interface Resource {
  name: string;
  url: string;
  /** One sentence: what you'll find there. */
  description: string;
}

/**
 * Places to find open-source projects to contribute to, shown on the landing page.
 * To add one, append an entry; the section displays them in this order.
 */
export const resources: Resource[] = [
  {
    name: "Up For Grabs",
    url: "https://up-for-grabs.net/",
    description:
      "A list of projects with tasks set aside for new contributors, filterable by language and tag.",
  },
  {
    name: "Good First Issue",
    url: "https://goodfirstissue.dev/",
    description: "Beginner-friendly issues from popular open-source projects, grouped by language.",
  },
  {
    name: "First Contributions",
    url: "https://github.com/firstcontributions/first-contributions",
    description: "A hands-on tutorial that walks you through making your very first pull request.",
  },
  {
    name: "First Timers Only",
    url: "https://www.firsttimersonly.com/",
    description:
      "Guidance and encouragement for people making their first open-source contribution.",
  },
];
