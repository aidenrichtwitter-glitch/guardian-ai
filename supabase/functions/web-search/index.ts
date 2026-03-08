// ═══════════════════════════════════════════════════
// WEB SEARCH — No AI, no API keys.
// Pure DuckDuckGo Instant Answers API.
// The system can search the web autonomously.
// ═══════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, batch } = await req.json();

    if (batch && Array.isArray(batch)) {
      // Batch search
      const results = await Promise.all(
        batch.map((q: string) => searchDuckDuckGo(q))
      );
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await searchDuckDuckGo(query);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function searchDuckDuckGo(query: string) {
  const encoded = encodeURIComponent(query);
  const response = await fetch(
    `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`
  );
  const data = await response.json();

  const results: { title: string; url: string; snippet: string }[] = [];

  if (data.Answer) {
    results.push({ title: 'Direct Answer', url: '', snippet: data.Answer });
  }

  if (data.Abstract) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL || '',
      snippet: data.Abstract,
    });
  }

  if (data.Definition) {
    results.push({
      title: 'Definition',
      url: data.DefinitionURL || '',
      snippet: data.Definition,
    });
  }

  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics.slice(0, 8)) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0]?.slice(0, 80) || '',
          url: topic.FirstURL,
          snippet: topic.Text.slice(0, 300),
        });
      }
      if (topic.Topics) {
        for (const sub of topic.Topics.slice(0, 3)) {
          if (sub.Text && sub.FirstURL) {
            results.push({
              title: sub.Text.split(' - ')[0]?.slice(0, 80) || '',
              url: sub.FirstURL,
              snippet: sub.Text.slice(0, 300),
            });
          }
        }
      }
    }
  }

  return { query, results, timestamp: Date.now() };
}
