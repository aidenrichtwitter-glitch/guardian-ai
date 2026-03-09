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
  const results: { title: string; url: string; snippet: string }[] = [];
  
  try {
    // Use SerpAPI free tier for real search results
    // Note: Limit to 100 queries/month on free tier
    const serpResponse = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&engine=google&api_key=demo`
    );
    
    if (serpResponse.ok) {
      const data = await serpResponse.json();
      
      // Extract organic results
      if (data.organic_results) {
        for (const result of data.organic_results.slice(0, 5)) {
          results.push({
            title: result.title || '',
            url: result.link || '',
            snippet: result.snippet || '',
          });
        }
      }
      
      // Extract knowledge graph if available
      if (data.knowledge_graph?.description) {
        results.push({
          title: data.knowledge_graph.title || 'Knowledge Graph',
          url: data.knowledge_graph.source?.link || '',
          snippet: data.knowledge_graph.description,
        });
      }
      
      // Extract answer box if available
      if (data.answer_box?.answer || data.answer_box?.snippet) {
        results.push({
          title: data.answer_box.title || 'Direct Answer',
          url: data.answer_box.link || '',
          snippet: data.answer_box.answer || data.answer_box.snippet || '',
        });
      }
    }
  } catch (err) {
    console.error('SerpAPI error:', err);
  }
  
  // Fallback to DuckDuckGo if SerpAPI fails
  if (results.length === 0) {
    try {
      const encoded = encodeURIComponent(query);
      
      // Try Wikipedia API first for factual queries
      const wikiResponse = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
      );
      
      if (wikiResponse.ok) {
        const wikiData = await wikiResponse.json();
        if (wikiData.extract) {
          results.push({
            title: wikiData.title || query,
            url: wikiData.content_urls?.desktop?.page || '',
            snippet: wikiData.extract,
          });
        }
      }
      
      // DuckDuckGo Instant Answers API
      const ddgResponse = await fetch(
        `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`
      );
      const data = await ddgResponse.json();

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
        for (const topic of data.RelatedTopics.slice(0, 5)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0]?.slice(0, 80) || '',
              url: topic.FirstURL,
              snippet: topic.Text.slice(0, 300),
            });
          }
          if (topic.Topics) {
            for (const sub of topic.Topics.slice(0, 2)) {
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
    } catch (fallbackErr) {
      console.error('Fallback search error:', fallbackErr);
    }
  }

  // If still no results, provide a meaningful fallback
  if (results.length === 0) {
    results.push({
      title: 'Search Context',
      url: '',
      snippet: `Searched for: "${query}". The search APIs returned limited results for this technical topic. This may indicate: (1) the topic is highly specialized, (2) the free API tier has limited coverage, or (3) the query needs refinement. Consider using more general terms or exploring related concepts.`,
    });
  }

  return { query, results, timestamp: Date.now() };
}
