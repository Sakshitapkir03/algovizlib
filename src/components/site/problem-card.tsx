import { ArrowRight, Clock, Film } from "lucide-react";
import Link from "next/link";

import { ExampleSourceBadge } from "@/components/learn/example-source-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime, getStoryboardDuration, type Storyboard } from "@/lib/storyboard";

const CATEGORY_LABEL: Record<Storyboard["category"], string> = {
  dsa: "Data structures & algorithms",
  "system-design": "System design",
};

export function ProblemCard({ storyboard }: { storyboard: Storyboard }) {
  return (
    <Card className="group relative transition-shadow hover:shadow-md motion-reduce:transition-none">
      <CardHeader>
        <p className="text-xs font-medium text-muted-foreground">{CATEGORY_LABEL[storyboard.category]}</p>
        <CardTitle className="text-lg">
          <Link
            href={`/learn/${storyboard.id}`}
            prefetch={true}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {storyboard.concept}
          </Link>
        </CardTitle>
        <CardDescription>{storyboard.summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        <ExampleSourceBadge source={storyboard.exampleSource} />
        {storyboard.tags.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </CardContent>
      <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Film aria-hidden className="size-3.5" /> {storyboard.scenes.length} scenes
          </span>
          <span className="flex items-center gap-1">
            <Clock aria-hidden className="size-3.5" /> {formatTime(getStoryboardDuration(storyboard))}
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </CardFooter>
    </Card>
  );
}
