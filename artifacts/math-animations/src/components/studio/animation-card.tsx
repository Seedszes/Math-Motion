import { useState, useEffect } from "react";
import { 
  Animation, 
  useGetAnimation, 
  useDeleteAnimation,
  getGetAnimationQueryKey,
  getListAnimationsQueryKey,
  getGetAnimationStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Loader2, PlayCircle, AlertTriangle, Code2, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatDistanceToNow } from "date-fns";

interface AnimationCardProps {
  initialAnimation: Animation;
}

export default function AnimationCard({ initialAnimation }: AnimationCardProps) {
  const queryClient = useQueryClient();
  const [isCodeOpen, setIsCodeOpen] = useState(false);

  const isPolling = initialAnimation.status === "pending" || initialAnimation.status === "generating";
  
  const { data: animation = initialAnimation } = useGetAnimation(initialAnimation.id, {
    query: {
      enabled: isPolling,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return (status === "pending" || status === "generating") ? 2000 : false;
      },
      initialData: initialAnimation,
    }
  });

  useEffect(() => {
    if (initialAnimation.status !== animation.status && (animation.status === "completed" || animation.status === "failed")) {
      queryClient.invalidateQueries({ queryKey: getListAnimationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAnimationStatsQueryKey() });
    }
  }, [animation.status, initialAnimation.status, queryClient]);

  const deleteAnim = useDeleteAnimation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnimationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAnimationStatsQueryKey() });
      }
    }
  });

  const handleDownload = async () => {
    if (!animation.videoUrl) return;
    const response = await fetch(animation.videoUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = animation.prompt.slice(0, 40).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.href = url;
    a.download = `math-motion-${slug}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderStatus = () => {
    switch (animation.status) {
      case "pending":
        return (
          <div className="flex items-center gap-2 text-yellow-500 font-mono text-sm">
            <Clock className="w-4 h-4" />
            <span>QUEUED</span>
          </div>
        );
      case "generating":
        return (
          <div className="flex items-center gap-2 text-primary font-mono text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>RENDERING</span>
          </div>
        );
      case "completed":
        return (
          <div className="flex items-center gap-2 text-green-400 font-mono text-sm">
            <PlayCircle className="w-4 h-4" />
            <span>READY</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-2 text-destructive font-mono text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>FAILED</span>
          </div>
        );
    }
  };

  return (
    <div className="group bg-card border border-border/50 hover:border-border transition-colors rounded-xl overflow-hidden flex flex-col shadow-sm">
      {/* Video / Placeholder Area */}
      <div className="aspect-video bg-black/40 relative flex items-center justify-center border-b border-border/50">
        {animation.status === "completed" && animation.videoUrl ? (
          <video 
            src={animation.videoUrl} 
            controls
            className="w-full h-full object-contain"
          />
        ) : animation.status === "failed" ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-destructive/50" />
            <p className="text-sm font-mono bg-destructive/10 text-destructive p-2 rounded w-full overflow-auto max-h-[100px]">
              {animation.errorMessage || "Unknown rendering error"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-primary/60">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            </div>
            <p className="font-mono text-sm animate-pulse tracking-wider">COMPUTING_MATHEMATICS...</p>
          </div>
        )}
      </div>

      {/* Details Area */}
      <div className="p-5 flex flex-col flex-1 gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            {renderStatus()}
            <p className="text-foreground leading-snug line-clamp-3" title={animation.prompt}>
              {animation.prompt}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(new Date(animation.createdAt), { addSuffix: true })}
              {animation.durationSeconds ? ` • ${animation.durationSeconds}s` : ""}
            </p>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            {animation.status === "completed" && animation.videoUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                title="Download video"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-border bg-card text-foreground">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete animation?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This action cannot be undone. This will permanently delete the animation and generated code.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-muted text-muted-foreground hover:bg-muted/80">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteAnim.mutate({ id: animation.id })}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Code Section */}
        {animation.manimCode && (
          <Collapsible open={isCodeOpen} onOpenChange={setIsCodeOpen} className="mt-auto pt-4 border-t border-border/50">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between font-mono text-xs text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  {isCodeOpen ? "HIDE_SOURCE" : "VIEW_SOURCE"}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-black/50 p-4 rounded-md overflow-x-auto border border-border/30">
                <pre className="text-xs font-mono text-primary/80">
                  <code>{animation.manimCode}</code>
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
