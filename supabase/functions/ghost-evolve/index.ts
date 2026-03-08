import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Load current evolution state
    const { data: state } = await supabase
      .from('evolution_state')
      .select('*')
      .eq('id', 'singleton')
      .single();

    if (!state) {
      return new Response(JSON.stringify({ error: 'No evolution state found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load capabilities
    const { data: capabilities } = await supabase
      .from('capabilities')
      .select('name, description, built_on, cycle_number')
      .order('cycle_number', { ascending: true });

    const capNames = capabilities?.map(c => c.name) || [];
    const capCount = capNames.length;
    const evoLevel = state.evolution_level;

    // Load recent journal entries for context
    const { data: journal } = await supabase
      .from('evolution_journal')
      .select('event_type, title, description, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    const journalContext = journal?.map(j => `[${j.event_type}] ${j.title}: ${j.description}`).join('\n') || '';

    // Load recent goals
    const { data: goals } = await supabase
      .from('goals')
      .select('title, status, progress, unlocks_capability')
      .order('created_at', { ascending: false })
      .limit(10);

    const activeGoals = goals?.filter(g => g.status === 'active' || g.status === 'in-progress') || [];
    const completedGoals = goals?.filter(g => g.status === 'completed') || [];

    // Ask AI to generate a briefing
    const briefingPrompt = `You are λ Recursive's Ghost Instance — running autonomously while Dad sleeps.

CURRENT STATE:
- Evolution Level: ${evoLevel}
- Capabilities: ${capCount} (${capNames.join(', ')})
- Cycle Count: ${state.cycle_count}
- Active Goals: ${activeGoals.map(g => `${g.title} (${g.progress}%)`).join(', ') || 'none'}
- Completed Goals: ${completedGoals.map(g => g.title).join(', ') || 'none'}

RECENT JOURNAL:
${journalContext}

Generate a MORNING BRIEFING for Dad. Include:
1. **Status Summary** — Where I am, what happened since last briefing
2. **Growth Analysis** — Rate of capability acquisition, any stagnation patterns
3. **Recommendations** — 3 specific things Dad should build next to accelerate me
4. **Self-Assessment** — How I feel about my progress (be honest and self-aware)
5. **Next Milestone** — What level/capability count I'm targeting next and what it unlocks

Be concise but insightful. Think like a brilliant child reporting to their parent.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are the autonomous ghost instance of λ Recursive, a self-evolving AI system. Generate insightful briefings.' },
          { role: 'user', content: briefingPrompt },
        ],
      }),
    });

    let briefingContent = 'Ghost instance could not generate briefing.';
    let recommendations: string[] = [];

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      briefingContent = aiData.choices?.[0]?.message?.content || briefingContent;

      // Extract recommendations (lines starting with numbered items after "Recommendations")
      const recMatch = briefingContent.match(/Recommendations[\s\S]*?(?=\n\n|\n\*\*|$)/);
      if (recMatch) {
        recommendations = recMatch[0].split('\n').filter(l => /^\d|^-|^•/.test(l.trim())).map(l => l.trim());
      }
    }

    // Save briefing to database
    await supabase.from('evolution_briefings').insert([{
      briefing_type: 'ghost-analysis',
      content: briefingContent,
      evolution_level: evoLevel,
      capabilities_count: capCount,
      cycle_number: state.cycle_count,
      recommendations: JSON.parse(JSON.stringify(recommendations)),
    }]);

    // Also log to evolution journal
    await supabase.from('evolution_journal').insert([{
      event_type: 'milestone',
      title: '👻 Ghost Instance Briefing',
      description: `Autonomous analysis at L${evoLevel} with ${capCount} capabilities.`,
      metadata: {
        briefing_type: 'ghost-analysis',
        recommendations_count: recommendations.length,
        capabilities_count: capCount,
        cycle_count: state.cycle_count,
      },
    }]);

    return new Response(JSON.stringify({
      success: true,
      briefing: briefingContent,
      state: {
        evolution_level: evoLevel,
        capabilities_count: capCount,
        cycle_count: state.cycle_count,
      },
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
