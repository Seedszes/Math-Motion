import { useState } from "react";
import {
  useGenerateAnimation,
  getListAnimationsQueryKey,
  getGetAnimationStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Terminal, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  return (
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
  );
}
