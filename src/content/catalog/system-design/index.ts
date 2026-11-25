import { definePlannedLesson, type AnyLesson } from "@/lib/catalog";

import { oneServer } from "./lessons/estimates/one-server";
import { chargedTwice } from "./lessons/idempotency/charged-twice";
import { stalePrice } from "./lessons/caching/stale-price";
import { stampede } from "./lessons/caching/stampede";
import { lostUpdate } from "./lessons/consistency/lost-update";
import { slowServer } from "./lessons/load-balancing/slow-server";
import { vanishedComment } from "./lessons/replication/vanished-comment";
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
  oneServer,
  slowServer,
  stalePrice,
  stampede,
  vanishedComment,
  planned(
    "sharding",
    "hot-key",
    "One celebrity melts a shard",
    "growth",
    "One account's followers took down a whole shard.",
    0,
  ),
  lostUpdate,
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
