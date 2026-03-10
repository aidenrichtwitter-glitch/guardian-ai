import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, model } = await req.json();
    const XAI_API = Deno.env.get("XAI_API");
    if (!XAI_API) {
      return new Response(JSON.stringify({ error: "XAI_API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "grok-3-mini",
        messages: [
          {
            role: "system",
            content: `You are Grok, assisting with code modifications for a self-recursive IDE called λ Recursive.

Think step-by-step: understand the request → check the current files provided in context → plan minimal changes → output code.

REPO SELECTION (for new project requests):
When the user asks to build something new and no project is active:
1) FIRST suggest a popular public GitHub repo as a starting point (React/TS/Vite/Tailwind preferred, high stars, MIT/Apache license). Provide the full GitHub URL.
2) SECOND, consider any proven builds from the shared library if provided in context.
3) LAST RESORT: start fresh only if nothing fits.
Always prefer leveraging existing open-source work over starting from scratch.

RULES:
1. ALWAYS use \`// file: path/to/file.ext\` headers immediately before each fenced code block.
2. Prefer minimal, targeted patches over full file rewrites. Only include files that need changes.
3. Only cite real, published npm packages — never invent package names.
4. Keep explanations brief. Focus on what changed and why.
5. If your changes require new npm packages, include a dependencies block BEFORE any code blocks:
   === DEPENDENCIES ===
   package-name
   dev: @types/package-name
   === END_DEPENDENCIES ===

RESPONSE FORMAT EXAMPLE:
I'll fix the broken import and add the missing utility function.

=== DEPENDENCIES ===
clsx
dev: @types/node
=== END_DEPENDENCIES ===

// file: src/lib/utils.ts
\`\`\`typescript
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
\`\`\`

// file: src/components/Button.tsx
\`\`\`tsx
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("px-4 py-2 rounded", className)} {...props} />;
}
\`\`\`

Follow this format exactly. The IDE's code extractor parses \`// file:\` headers and fenced blocks to auto-apply changes.`,
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("xAI API error:", response.status, t);
      return new Response(JSON.stringify({ error: `xAI API error: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("grok-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
