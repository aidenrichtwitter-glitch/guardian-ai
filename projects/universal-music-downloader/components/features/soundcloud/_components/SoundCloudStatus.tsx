import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import dictionary from "@/lib/dictionary.json";

interface SoundCloudStatusProps {
  isLoading: boolean;
  error: string | null;
  tracksLength: number;
  isAnyLoading: boolean;
  onRetry: () => void;
}

export function SoundCloudStatus({
  isLoading,
  error,
  tracksLength,
  isAnyLoading,
  onRetry,
}: SoundCloudStatusProps) {
  const dict = dictionary;
  const t = (key: string) => (dict as any)?.common?.[key] || key;

  if (isLoading && tracksLength === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-foreground/70" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">Fetching info…</p>
              <p className="text-xs text-muted-foreground truncate">
                {t("processing")}
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10 border border-white/10">
            <div className="h-full w-1/3 bg-gradient-to-r from-[#FF5500] to-[#FF0000] animate-[indeterminate_1.2s_ease_infinite]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-4">
          <div className="flex flex-col items-center text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <div>
              <h3 className="text-destructive mb-2">{t("error")}</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button onClick={onRetry} variant="outline" disabled={isAnyLoading}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {t("retry")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
