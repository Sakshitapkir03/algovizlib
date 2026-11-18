import { defineCategory } from "@/lib/catalog";

export const categories = [
  defineCategory({
    slug: "dsa",
    name: "Data Structures & Algorithms",
    description:
      "Learn the handful of patterns behind most interview problems, then practice recognizing them on real problems.",
    status: "available",
  }),
  defineCategory({
    slug: "system-design",
    name: "System Design",
    description:
      "How real systems stay fast and reliable under load, explained with boxes, arrows, and requests.",
    status: "coming-soon",
    plannedTopics: [
      {
        name: "Load balancing",
        summary: "Spreading requests across servers, and what happens when one fails.",
      },
      { name: "Caching", summary: "Where to cache, what to evict, and how stale data sneaks in." },
      {
        name: "Rate limiting",
        summary: "Token buckets and sliding windows that keep one client from hogging a service.",
      },
      { name: "Databases and sharding", summary: "Replication, partitioning, and choosing a shard key." },
      { name: "Message queues", summary: "Decoupling producers from consumers, retries, and ordering." },
      {
        name: "URL shortener design",
        summary: "An end-to-end design: IDs, storage, redirects, and analytics.",
      },
    ],
  }),
];
