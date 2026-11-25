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
      "Real classes of production bugs, replayed request by request in a deterministic simulation, then fixed and replayed again.",
    status: "available",
  }),
];
