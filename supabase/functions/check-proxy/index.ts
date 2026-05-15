import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { proxies } = await req.json()
    if (!proxies || !Array.isArray(proxies)) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // Check each proxy by attempting a small fetch via Deno's built-in fetch
    // Note: Deno deploy allows standard fetch but tunneling through proxy requires custom agents
    // For simplicity, we'll return a simulated real check for now, 
    // or you can implement a Node.js runtime worker.
    
    const results = await Promise.all(proxies.map(async (proxy: any) => {
      // Logic kiểm tra thực tế (PING/CURL) sẽ phụ thuộc vào thư viện HTTP Client có hỗ trợ proxy
      // Trong Deno, ta có thể dùng fetch với proxy config nếu được hỗ trợ
      
      try {
        // Giả lập logic ping (thay thế bằng thư viện kiểm tra Proxy thực ở môi trường Node.js nếu cần)
        const isAlive = Math.random() > 0.1; // 90% tỉ lệ sống trong giả lập thực tế
        return {
          id: proxy.id,
          status: isAlive ? 'active' : 'dead',
          latency: isAlive ? Math.floor(Math.random() * 500) + 50 : -1
        };
      } catch (e) {
        return { id: proxy.id, status: 'dead', latency: -1 };
      }
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
