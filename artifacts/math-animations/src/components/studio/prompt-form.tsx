import { useState } from "react";
import {
  useGenerateAnimation,
  getListAnimationsQueryKey,
  getGetAnimationStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Terminal, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXAMPLE_PROMPTS = [
  "Show a sine wave evolving into a cosine wave",
  "Visualize the Pythagorean theorem",
  "Animate a circle being divided into π",
  "Show how a Fourier series builds a square wave",
  "Visualize the derivative as a tangent line",
  "Show bubble sort step by step",
  "Animate the unit circle with sin and cos",
  "Demonstrate the golden ratio in a spiral",
];

export default function PromptForm() {
  const [prompt, setPrompt] = useState("");
  const queryClient = useQueryClient();

  const generate = useGenerateAnimation({
    mutation: {
      onSuccess: () => {
        setPrompt("");
        queryClient.invalidateQueries({
          queryKey: getListAnimationsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetAnimationStatsQueryKey(),
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || generate.isPending) return;
    generate.mutate({ data: { prompt } });
  };

  const handleExample = (example: string) => {
    if (generate.isPending) return;
    setPrompt(example);
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="w-full relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-secondary rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
        <div className="relative flex items-center bg-card border border-border/50 rounded-lg shadow-xl overflow-hidden focus-within:border-primary/50 transition-colors">
          <div className="pl-4 pr-2 text-muted-foreground">
            <Terminal className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Draw a sine wave evolving into a cosine wave..."
            className="flex-1 bg-transparent border-0 py-4 px-2 text-base md:text-lg focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground/50 font-mono"
            disabled={generate.isPending}
          />
          <div className="pr-2">
            <Button
              type="submit"
              disabled={!prompt.trim() || generate.isPending}
              className="font-mono gap-2"
            >
              {generate.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              Render
            </Button>
          </div>
        </div>
      </form>

      {/* Example prompts */}
      <div className="flex flex-wrap gap-2 justify-center">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            onClick={() => handleExample(example)}
            disabled={generate.isPending}
            className="px-3 py-1.5 rounded-full text-xs font-mono bg-card/60 border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-card transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed truncate max-w-[260px]"
            title={example}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
