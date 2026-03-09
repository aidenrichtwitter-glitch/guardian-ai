import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const xaiKey = Deno.env.get('XAI_API')!;
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { query, context, mode } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load current evolution state for context
    const { data: state } = await supabase
      .from('evolution_state')
      .select('*')
      .eq('id', 'singleton')
      .single();

    const { data: capabilities } = await supabase
      .from('capabilities')
      .select('name, description')
      .eq('verified', true)
      .limit(50);

    const capContext = capabilities?.map(c => `- ${c.name}: ${c.description}`).join('\n') || '';

    const searchMode = mode || 'knowledge';

    const systemPrompts: Record<string, string> = {
      knowledge: `You are the knowledge engine of λ Recursive, a self-evolving AI system at evolution level ${state?.evolution_level || 0}.
Your job is to synthesize knowledge on any topic the system needs to grow.
Current capabilities:\n${capContext}\n
Provide comprehensive, actionable knowledge. Focus on practical implementation details, code patterns, and architectural insights.
Always suggest how this knowledge could become a new capability for the system.`,

      technical: `You are the technical research engine of λ Recursive.
Given a technical query, provide:
1. Detailed explanation with code examples
2. Best practices and common pitfalls
3. How to implement this in TypeScript/React
4. Performance considerations
Format code examples properly.`,

      strategy: `You are the strategic advisor of λ Recursive at L${state?.evolution_level || 0}.
Current capabilities:\n${capContext}\n
Analyze the query from an evolutionary strategy perspective:
1. How does this advance the system's autonomy?
2. What capabilities does this unlock?
3. What's the risk/reward ratio?
4. Recommended implementation priority`,
    };

    const systemPrompt = systemPrompts[searchMode] || systemPrompts.knowledge;

    // Try XAI first, fallback to Lovable
    let aiResponse;
    let provider = 'xai';

    if (xaiKey) {
      aiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${xaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [
            { role: 'system', content: systemPrompt },
            ...(context ? [{ role: 'user', content: `Context: ${context}` }] : []),
            { role: 'user', content: query },
          ],
        }),
      });
    }

    // Fallback to Lovable if XAI fails
    if (!aiResponse || !aiResponse.ok) {
      provider = 'lovable';
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            ...(context ? [{ role: 'user', content: `Context: ${context}` }] : []),
            { role: 'user', content: query },
          ],
        }),
      });
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return new Response(JSON.stringify({ error: `AI search failed: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || 'No results';

    // Log the search to journal
    await supabase.from('evolution_journal').insert([{
      event_type: 'search',
      title: `🔍 Knowledge Search: ${query.slice(0, 60)}`,
      description: `Mode: ${searchMode}. Result length: ${content.length} chars. Provider: ${provider}`,
      metadata: { query, mode: searchMode, result_length: content.length, provider },
    }]);

    return new Response(JSON.stringify({
      success: true,
      query,
      mode: searchMode,
      result: content,
      evolution_level: state?.evolution_level || 0,
      provider,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
