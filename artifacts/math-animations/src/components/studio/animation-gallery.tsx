import { Animation } from "@workspace/api-client-react";
import AnimationCard from "./animation-card";
import { Sparkles } from "lucide-react";

interface AnimationGalleryProps {
  animations?: Animation[];
  isLoading: boolean;
}

export default function AnimationGallery({ animations, isLoading }: AnimationGalleryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[400px] rounded-lg bg-card/50 border border-border/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!animations || animations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/50 rounded-lg bg-card/30">
        <div className="bg-primary/10 p-4 rounded-full mb-4 text-primary">
          <Sparkles className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-medium mb-2">No animations yet</h3>
        <p className="text-muted-foreground max-w-sm">
          Enter a prompt above to generate your first mathematical animation. It will appear here once ready.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {animations.map((animation) => (
        <AnimationCard key={animation.id} initialAnimation={animation} />
      ))}
    </div>
  );
}
