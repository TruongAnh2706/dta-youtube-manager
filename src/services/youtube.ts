export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const normalizeYoutubeUrl = (url: string) => {
    if (!url) return '';
    try {
        let clean = decodeURIComponent(url).trim().toLowerCase();
        // Xóa protocol (http/https) và www.
        clean = clean.replace(/^https?:\/\/(www\.)?/, '');
        // Xóa các đuôi phổ biến của youtube (videos, shorts...)
        clean = clean.replace(/\/(videos|shorts|streams|featured|about|playlists|community)(\/?)$/, '');
        // Xóa tham số truy vấn (ví dụ ?view=0)
        clean = clean.split('?')[0];
        // Xóa dấu gạch chéo ở cuối cùng nếu có
        clean = clean.replace(/\/$/, '');
        return clean;
    } catch (e) {
        return url.toLowerCase().trim();
    }
};

export async function fetchYoutubeChannelInfo(url: string, apiKey: string, skipTopVideos: boolean = false) {
  if (!apiKey) throw new Error("Thiếu YouTube API Key. Vui lòng cấu hình trong phần Cài đặt.");
  
  // 1. Decode URL để xử lý các ký tự encode (ví dụ tiếng Nhật Bản %E3%83...)
  const decodedUrl = decodeURIComponent(url);

  // 2. Extract ID or Handle
  const channelIdMatch = decodedUrl.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  const handleMatch = decodedUrl.match(/youtube\.com\/@([^/?]+)/);
  const customMatch = decodedUrl.match(/youtube\.com\/(c|user)\/([^/?]+)/);
  
  let apiUrl = '';

  if (channelIdMatch) {
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings&id=${channelIdMatch[1]}&key=${apiKey}`;
  } else if (handleMatch) {
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings&forHandle=%40${handleMatch[1]}&key=${apiKey}`;
  } else if (customMatch) {
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings&forUsername=${customMatch[2]}&key=${apiKey}`;
  } else {
    throw new Error("URL không hợp lệ. Vui lòng dùng link dạng youtube.com/channel/UC... hoặc youtube.com/@handle");
  }

  // 2. Fetch Channel Details
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    
    if (data.error) {
      const errorMsg = data.error.message || "";
      if (errorMsg.includes("quota") || errorMsg.includes("limit")) {
        throw new Error("API KEY Youtube V3 của bạn đã hết lượt sử dụng, vui lòng quay lại vào ngày mai hoặc đổi Key mới.");
      }
      if (errorMsg.includes("API key not valid") || errorMsg.includes("keyInvalid")) {
        throw new Error("API KEY Youtube V3 không hợp lệ. Vui lòng kiểm tra lại trong phần Cài đặt.");
      }
      if (errorMsg.includes("blocked") || errorMsg.includes("restricted")) {
        throw new Error("API Key này đang bị chặn hoặc bị giới hạn quyền truy cập. Vui lòng kiểm tra mục 'API Restrictions' trong Google Cloud Console và đảm bảo đã bật 'YouTube Data API v3'.");
      }
      throw new Error(data.error.message || "Lỗi từ YouTube API");
    }
    
    if (!data.items || data.items.length === 0) {
      throw new Error("Không tìm thấy kênh. Vui lòng kiểm tra lại đường dẫn (URL) có chính xác không.");
    }
    
    const channel = data.items[0];
    const channelId = channel.id;
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    
    let latestVideos = [];
    if (uploadsPlaylistId) {
      try {
        const latestRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=5&key=${apiKey}`);
        const latestData = await latestRes.json();
        
        if (latestData.items && latestData.items.length > 0) {
          const videoIds = latestData.items.map((item: any) => item.snippet.resourceId.videoId).join(',');
          const videoDetailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`);
          const videoDetailsData = await videoDetailsRes.json();
          
          latestVideos = videoDetailsData.items?.map((item: any) => ({
            id: item.id,
            title: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            publishedAt: item.snippet.publishedAt,
            viewCount: parseInt(item.statistics.viewCount || '0', 10),
            duration: item.contentDetails.duration,
            tags: item.snippet.tags || [],
            description: item.snippet.description || ''
          })) || [];
        }
      } catch (e) {
        console.error("Lỗi lấy video mới nhất:", e);
      }
    }

    let topVideos = [];
    if (!skipTopVideos) {
      try {
        const topRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=viewCount&type=video&maxResults=5&key=${apiKey}`);
        const topData = await topRes.json();
        
        if (topData.items && topData.items.length > 0) {
          const videoIds = topData.items.map((item: any) => item.id.videoId).join(',');
          const videoDetailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`);
          const videoDetailsData = await videoDetailsRes.json();
          
          topVideos = videoDetailsData.items?.map((item: any) => ({
            id: item.id,
            title: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            publishedAt: item.snippet.publishedAt,
            viewCount: parseInt(item.statistics.viewCount || '0', 10),
            duration: item.contentDetails.duration,
            tags: item.snippet.tags || [],
            description: item.snippet.description || ''
          })) || [];
        }
      } catch (e) {
        console.error("Lỗi lấy video phổ biến:", e);
      }
    }

    const subCount = parseInt(channel.statistics.subscriberCount || '0', 10);
    const viewCount = parseInt(channel.statistics.viewCount || '0', 10);
    const videoCount = parseInt(channel.statistics.videoCount || '0', 10);
    
    let rating = 3;
    if (videoCount > 0) {
      const avgViews = viewCount / videoCount;
      if (avgViews > 500000) rating = 5;
      else if (avgViews > 100000) rating = 4;
      else if (avgViews > 10000) rating = 3;
      else if (avgViews > 1000) rating = 2;
      else rating = 1;
    }

    return {
      name: channel.snippet.title,
      avatarUrl: channel.snippet.thumbnails?.default?.url || '',
      subscribers: subCount,
      totalViews: viewCount,
      videoCount: videoCount,
      publishedAt: channel.snippet.publishedAt,
      description: channel.snippet.description,
      channelKeywords: channel.brandingSettings?.channel?.keywords || '', // Dữ liệu Tags ẩn của kênh
      latestVideos,
      topVideos,
      calculatedRating: rating
    };
  } catch (error: any) {
    throw new Error(error.message || "Không thể kết nối đến YouTube API");
  }
}
