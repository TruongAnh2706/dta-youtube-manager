import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { channelUrl, videoId, videoUrl } = await req.json()

    if (!channelUrl && !videoId && !videoUrl) {
      return new Response(JSON.stringify({ error: 'Thiếu thông tin đầu vào. Cần truyền URL kênh, video ID hoặc URL video.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    let targetVideoId = videoId

    // 1. Nếu có videoUrl, trích xuất videoId
    if (!targetVideoId && videoUrl) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
      const match = videoUrl.match(regExp)
      if (match && match[2].length === 11) {
        targetVideoId = match[2]
      }
    }

    // 2. Nếu vẫn không có videoId nhưng có channelUrl, cào trang kênh để tìm videoId mới nhất
    if (!targetVideoId && channelUrl) {
      console.log(`[MONETIZATION] Cào video mới nhất từ kênh: ${channelUrl}`)
      const channelResponse = await fetch(channelUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache'
        }
      })

      if (!channelResponse.ok) {
        return new Response(JSON.stringify({ error: `Không thể kết nối đường dẫn kênh (HTTP ${channelResponse.status}).` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      const channelHtml = await channelResponse.text()
      
      // Phát hiện bot detection của YouTube
      if (channelHtml.includes('sorry/index') || channelHtml.includes('consent.youtube.com')) {
        return new Response(JSON.stringify({ error: 'Yêu cầu cào video mới nhất bị YouTube chặn (Rate Limit). Vui lòng thử lại sau.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429
        })
      }

      // Tìm videoId bằng Regex
      const videoIdMatch = channelHtml.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)
      if (videoIdMatch) {
        targetVideoId = videoIdMatch[1]
        console.log(`[MONETIZATION] Tìm thấy videoId từ kênh: ${targetVideoId}`)
      } else {
        // Thử tìm bằng regex watch?v=
        const watchMatch = channelHtml.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/)
        if (watchMatch) {
          targetVideoId = watchMatch[1]
          console.log(`[MONETIZATION] Tìm thấy videoId dạng watch từ kênh: ${targetVideoId}`)
        }
      }
    }

    if (!targetVideoId) {
      return new Response(JSON.stringify({ error: 'Không tìm thấy video nào công khai trên kênh để kiểm tra.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    console.log(`[MONETIZATION] Đang kiểm tra trạng thái kiếm tiền của video ID: ${targetVideoId}`)
    const videoResponse = await fetch(`https://www.youtube.com/watch?v=${targetVideoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache'
      }
    })

    if (!videoResponse.ok) {
      return new Response(JSON.stringify({ error: `Không thể kết nối đến video YouTube (HTTP ${videoResponse.status}).` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const videoHtml = await videoResponse.text()

    // Kiểm tra bot detection
    if (videoHtml.includes('sorry/index') || videoHtml.includes('consent.youtube.com')) {
      return new Response(JSON.stringify({ error: 'Yêu cầu phân tích video bị YouTube chặn (Rate Limit). Vui lòng thử lại sau.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429
      })
    }

    // Thực hiện quét flag kiếm tiền
    const isMonetized = videoHtml.includes('"is_monetization_enabled":true') || 
                        videoHtml.includes('"key":"is_monetization_enabled","value":"true"') ||
                        videoHtml.includes('is_monetization_enabled=true')
                        
    const isNotMonetized = videoHtml.includes('"is_monetization_enabled":false') || 
                           videoHtml.includes('"key":"is_monetization_enabled","value":"false"') ||
                           videoHtml.includes('is_monetization_enabled=false')

    console.log(`[MONETIZATION] Kết quả check cho ${targetVideoId}: matches_true=${isMonetized}, matches_false=${isNotMonetized}`)

    let finalStatus = null
    if (isMonetized) {
      finalStatus = true
    } else if (isNotMonetized) {
      finalStatus = false
    } else {
      // Tìm kiếm ad signals phụ
      const hasAdSignals = videoHtml.includes('yt_ad_signals') || videoHtml.includes('adPlacements')
      if (hasAdSignals) {
        finalStatus = true
      }
    }

    if (finalStatus !== null) {
      return new Response(JSON.stringify({ success: true, isMonetized: finalStatus, videoId: targetVideoId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ 
        error: 'Không tìm thấy thông tin kiếm tiền từ video này.',
        isMonetized: null,
        videoId: targetVideoId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      })
    }

  } catch (error) {
    console.error('[MONETIZATION] Lỗi khi kiểm tra kiếm tiền:', error)
    return new Response(JSON.stringify({ error: 'Lỗi hệ thống khi cào dữ liệu từ YouTube: ' + error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
