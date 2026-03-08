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
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { targetUrl, method, payload, headers: customHeaders, serviceName } = await req.json();

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'targetUrl required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up API key from registry if serviceName provided
    let apiKey = '';
    if (serviceName) {
      const { data: registry } = await supabase
        .from('api_registry')
        .select('*')
        .eq('service_name', serviceName)
        .eq('is_active', true)
        .single();

      if (!registry) {
        return new Response(JSON.stringify({ error: `Service '${serviceName}' not found or inactive` }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Build headers
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders || {}),
    };

    // Make the proxied request
    const fetchOptions: RequestInit = {
      method: method || 'GET',
      headers: fetchHeaders,
    };

    if (payload && (method || 'GET') !== 'GET') {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const responseData = await response.text();

    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = { raw: responseData };
    }

    return new Response(JSON.stringify({
      status: response.status,
      data: parsedData,
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
