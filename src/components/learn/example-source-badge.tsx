import { Globe, Lightbulb } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ExampleSource } from "@/lib/storyboard";

export function ExampleSourceBadge({ source }: { source: ExampleSource }) {
  return source === "problem-native" ? (
    <Badge variant="secondary">
      <Globe aria-hidden data-icon="inline-start" />
      Real-world problem
    </Badge>
  ) : (
    <Badge variant="secondary">
      <Lightbulb aria-hidden data-icon="inline-start" />
      Explained with an analogy
    </Badge>
  );
}
