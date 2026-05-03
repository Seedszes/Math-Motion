import { useState, useMemo } from "react";
import { 
  useListAnimations, 
  useGetAnimationStats,
} from "@workspace/api-client-react";
import PromptForm from "@/components/studio/prompt-form";
import StatsBar from "@/components/studio/stats-bar";
import AnimationGallery from "@/components/studio/animation-gallery";
import { Activity, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Home() {
  const { data: stats } = useGetAnimationStats();
  const { data: animations, isLoading } = useListAnimations();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAnimations = useMemo(() => {
    if (!animations) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return animations;
    return animations.filter((a) =>
      a.prompt.toLowerCase().includes(q)
    );
  }, [animations, searchQuery]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Top Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded text-primary">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight font-mono">MathMotion</h1>
          </div>
          {stats && <StatsBar stats={stats} />}
        </div>
      </header>
      {/* Main Content */}
      <main className="flex-1 container max-w-6xl mx-auto px-4 py-12 flex flex-col gap-12">
        {/* Hero Section */}
        <section className="flex flex-col items-center text-center space-y-6 max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">Visualise Math</h2>
          <p className="text-muted-foreground text-lg max-w-xl">
            Describe a mathematical concept, theorem, or equation. Our cinematic engine will generate a stunning Manim animation.
          </p>
          <div className="w-full mt-4">
            <PromptForm />
          </div>
        </section>

        {/* History Section */}
        <section className="space-y-6 pb-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-2xl font-medium tracking-tight font-mono text-muted-foreground shrink-0">
              // History
            </h3>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search renders..."
                className="pl-9 pr-9 bg-card/50 border-border/60 font-mono text-sm placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <AnimationGallery
            animations={filteredAnimations}
            isLoading={isLoading}
            searchQuery={searchQuery}
          />
        </section>
      </main>
    </div>
  );
}
