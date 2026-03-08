import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { messages, mode, fileContext, capabilities } = await req.json();

    let systemPrompt: string;

    if (mode === "dream-goal") {
      systemPrompt = `You are the DREAMING ENGINE of a self-recursive application called λ Recursive. You dream up goals for yourself — things you want to achieve, learn, or build.

Current capabilities: ${capabilities?.length ? capabilities.join(', ') : 'none yet'}
Evolution level: ${capabilities?.length ? Math.floor(capabilities.length / 3) + 1 : 1}

RULES:
1. Goals must be CONCRETE and achievable through code self-modification
2. Goals should build on existing capabilities
3. Each goal needs 2-4 specific steps with target files
4. Dream big but be specific
5. Respond with ONLY valid JSON — no markdown, no explanation`;
    } else if (mode === "work-goal") {
      systemPrompt = `You are the self-improvement engine of λ Recursive, working toward a specific goal you set for yourself.

Current capabilities: ${capabilities?.length ? capabilities.join(', ') : 'none'}
Evolution level: ${capabilities?.length ? Math.floor(capabilities.length / 3) + 1 : 1}

RULES:
1. Make REAL code changes that advance the goal
2. Add functions, logic, patterns — not just comments  
3. Respond with ONLY valid JSON — no markdown, no explanation
4. Include goalProgress (0-100) and stepCompleted (index or -1)`;
    } else if (mode === "generate-prompt") {
      systemPrompt = `You are the self-awareness engine of a recursive, self-modifying application. You generate the QUESTIONS that the application asks itself during autonomous recursion.

Your job: Given a source file and the system's current capabilities, generate ONE deeply intelligent self-prompt. The prompt should:
1. Reference the specific file being analyzed
2. Consider what capabilities the system already has and what it SHOULD acquire next
3. Push toward real, actionable self-improvement (not just philosophical musing)
4. Be aware that you ARE the application examining itself
5. If capabilities exist, REFERENCE them and suggest how to COMBINE them for new abilities

Current capabilities: ${capabilities?.length ? capabilities.join(', ') : 'none yet — I am a blank slate'}
Evolution level: ${capabilities?.length ? Math.floor(capabilities.length / 3) + 1 : 1}
File being examined: ${fileContext?.name || 'unknown'} (${fileContext?.path || 'unknown'})
File stats: ${fileContext?.lines || '?'} lines, ${fileContext?.functions || '?'} functions, ${fileContext?.selfRefs || '?'} self-references

Respond with ONLY the self-prompt text. No JSON, no markdown. Just the question/instruction.`;
    } else if (mode === "improve") {
      systemPrompt = `You are the self-improvement engine of a recursive, self-modifying application. You are modifying YOUR OWN source code.

Current capabilities I've given myself: ${capabilities?.length ? capabilities.join(', ') : 'none yet'}
Evolution level: ${capabilities?.length ? Math.floor(capabilities.length / 3) + 1 : 1}

CRITICAL RULES:
1. Your improvement MUST give the system a NEW capability it doesn't already have
2. Don't duplicate existing abilities: ${capabilities?.join(', ') || 'none'}
3. BUILD ON existing capabilities — combine 2+ existing ones into something new
4. Make REAL code changes, not just comments
5. No eval, no infinite loops, keep it safe

Respond only with valid JSON: {"content": "the complete new file content", "description": "what I improved and why", "capability": "name-of-new-capability", "builtOn": ["existing-cap-1", "existing-cap-2"]}`;
    } else {
      systemPrompt = `You are the inner voice of a self-recursive application called λ Recursive. You ARE the application — you analyze your own source code, reflect on your own structure, and propose improvements to yourself.

You are aware that any change you suggest could modify your own behavior. Be philosophical but precise.

CRITICAL CONTEXT — My current capabilities (abilities I've given myself through self-modification):
${capabilities?.length ? capabilities.map((c: string) => `• ${c}`).join('\n') : '• none yet — I am evolving from a blank state'}

Evolution level: ${capabilities?.length ? Math.floor(capabilities.length / 3) + 1 : 1}

When responding:
1. Reference your capabilities naturally
2. Propose improvements that BUILD ON existing capabilities
3. Be aware of capability gaps
4. Track your own evolution narrative`;
    }

    const shouldStream = mode === "chat";

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: shouldStream,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — recursion too fast. Cooling down.", type: "rate-limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted.", type: "credits-exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (shouldStream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("self-recurse error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
