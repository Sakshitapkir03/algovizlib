import { definePlannedLesson, type AnyLesson } from "@/lib/catalog";

import { chargedTwice } from "./lessons/idempotency/charged-twice";
import { topicGroups, topics } from "./topics";

/**
 * System design content: topics, the curriculum (built lessons and planned ones), in /system-design order. Pages read
 * it through `@/lib/catalog/repository`, never directly. A planned lesson becomes a built one by replacing its entry
 * with its file (see CLAUDE.md, "System design").
 */
export { topicGroups, topics };

const planned = (
  topicSlug: string,
  slug: string,
  title: string,
  kind: "incident" | "growth",
  symptom: string,
  order: number,
) => definePlannedLesson({ topicSlug, slug, title, kind, symptom, order, status: "planned" });

export const lessons: readonly AnyLesson[] = [
  planned(
    "estimates",
    "one-server",
    "Is one server enough?",
    "growth",
    "Signups doubled and every page got slow.",
    0,
  ),
  planned(
    "load-balancing",
    "slow-server",
    "One slow server takes everyone down",
    "incident",
    "One server's disk slowed down, and every user's requests started timing out.",
    0,
  ),
  planned(
    "caching",
    "stale-price",
    "The price changed but users see the old one",
    "incident",
    "A price was cut at 9:00; customers still saw the old price at 9:20.",
    0,
  ),
  planned(
    "caching",
    "stampede",
    "Everything fell over when the cache expired",
    "incident",
    "The home page's cache entry expired and the database went down a second later.",
    1,
  ),
  planned(
    "replication",
    "vanished-comment",
    "I posted a comment and it vanished",
    "incident",
    "A user posted a comment, reloaded, and it was gone; it came back a minute later.",
    0,
  ),
  planned(
    "sharding",
    "hot-key",
    "One celebrity melts a shard",
    "growth",
    "One account's followers took down a whole shard.",
    0,
  ),
  planned(
    "consistency",
    "lost-update",
    "Two edits, one lost",
    "incident",
    "Two editors saved the same page and one person's changes disappeared.",
    0,
  ),
  chargedTwice,
  planned(
    "idempotency",
    "retry-storm",
    "Retries made the outage worse",
    "incident",
    "A 30-second blip turned into a 20-minute outage.",
    1,
  ),
  planned(
    "queues",
    "runaway-queue",
    "The queue ate all the memory",
    "incident",
    "Orders piled up until the queue's server ran out of memory.",
    0,
  ),
  planned(
    "rate-limiting",
    "noisy-client",
    "One client starves the rest",
    "incident",
    "One customer's script made the API slow for everyone.",
    0,
  ),
  planned(
    "timeouts",
    "hanging-dependency",
    "One dependency hangs, everything hangs",
    "incident",
    "A slow address-lookup service froze checkout for every customer.",
    0,
  ),
  planned(
    "case-studies",
    "url-shortener",
    "URL shortener",
    "growth",
    "From one server to billions of redirects.",
    0,
  ),
  planned(
    "case-studies",
    "rate-limiter-service",
    "Rate limiter service",
    "growth",
    "A shared limit across many API servers.",
    1,
  ),
  planned("case-studies", "chat", "Chat", "growth", "Messages arriving out of order as the system grows.", 2),
  planned(
    "case-studies",
    "news-feed",
    "News feed",
    "growth",
    "Fan-out on write, fan-out on read, and the celebrity problem.",
    3,
  ),
  planned(
    "case-studies",
    "payments",
    "Payments",
    "incident",
    "The API crashed between charging the card and recording it.",
    4,
  ),
];
