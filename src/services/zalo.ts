import { SystemSettings } from '../types';

/**
 * Gửi tin nhắn đến Zalo (Hỗ trợ cả Webhook bên thứ 3 và Zalo OA chính thức)
 */
export async function sendZaloMessage(message: string, settings?: SystemSettings): Promise<boolean> {
  const enabled = settings?.zaloEnabled;
  const apiUrl = settings?.zaloApiUrl;
  const accessToken = settings?.zaloAccessToken;
  const recipientId = settings?.zaloPhoneOrGroupId; // Có thể là SĐT hoặc User ID Zalo

  if (!enabled) {
    return false;
  }

  // Phương án 1: Sử dụng Webhook Zalo bên thứ 3 (Rất khuyên dùng cho vận hành nội bộ nhóm)
  if (apiUrl) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          text: message,
          to: recipientId,
          chat_id: recipientId,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('Zalo Webhook Request Error:', error);
      return false;
    }
  }

  // Phương án 2: Sử dụng Zalo OA Chat API chính thống (Yêu cầu Token & Người nhận quan tâm OA)
  if (accessToken && recipientId) {
    try {
      // Endpoint gửi tin nhắn giao dịch/chăm sóc khách hàng của Zalo OA chính thức
      const response = await fetch('https://openapi.zalo.me/v3.0/oa/message/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': accessToken,
        },
        body: JSON.stringify({
          recipient: {
            user_id: recipientId, // Zalo User ID (không phải SĐT trực tiếp, cần lấy qua webhook quan tâm OA)
          },
          message: {
            text: message,
          },
        }),
      });

      const data = await response.json();
      if (data.error !== 0) {
        console.error('Zalo OA API Error:', data.message);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Zalo OA Request Error:', error);
      return false;
    }
  }

  console.warn('Cấu hình Zalo chưa đầy đủ (Thiếu Webhook URL hoặc Access Token + Recipient ID)!');
  return false;
}

/**
 * Gửi cảnh báo Proxy bị lỗi (Die) qua Zalo
 */
export async function sendZaloProxyAlert(proxyIp: string, proxyPort: string, notes: string, settings?: SystemSettings): Promise<boolean> {
  const message = `🚨 DTA STUDIO - BÁO ĐỘNG HỆ THỐNG ZALO 🚨
---------------------------------------------
🔌 Sự cố: Proxy mất kết nối (DEAD)!
💻 IP: ${proxyIp}:${proxyPort}
📝 Ghi chú: ${notes || 'Không có ghi chú'}
⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}

⚠️ Vui lòng kiểm tra và thay thế Proxy mới để bảo vệ kênh!
---------------------------------------------
Phát triển bởi DTA Studio - Đức Trường AI (0962.775.506)`;

  return sendZaloMessage(message.trim(), settings);
}

/**
 * Gửi cảnh báo có Gậy bản quyền mới qua Zalo
 */
export async function sendZaloStrikeAlert(
  channelName: string, 
  strikeType: 'copyright' | 'community', 
  details: string, 
  expirationDate: string, 
  settings?: SystemSettings
): Promise<boolean> {
  const typeLabel = strikeType === 'copyright' ? '🔴 Gậy bản quyền (Copyright Strike)' : '🟡 Cảnh cáo nguyên tắc cộng đồng (Community Strike)';
  const message = `🚨 DTA STUDIO - CẢNH BÁO BẢN QUYỀN 🚨
---------------------------------------------
📢 Kênh nhận gậy: ${channelName}
⚠️ Loại vi phạm: ${typeLabel}
📝 Chi tiết: ${details || 'Không có chi tiết'}
📅 Ngày hết hạn dự kiến: ${expirationDate || 'Không rõ'}
⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}

🤖 Trình soạn thảo DTA AI Appeal Writer đã sẵn sàng viết thư kháng cáo chuẩn pháp lý Hoa Kỳ!
---------------------------------------------
Phát triển bởi DTA Studio - Đức Trường AI (0962.775.506)`;

  return sendZaloMessage(message.trim(), settings);
}

/**
 * Gửi cảnh báo trễ lịch đăng video qua Zalo
 */
export async function sendZaloScheduleDelayAlert(
  videoTitle: string, 
  channelName: string, 
  scheduledTime: string, 
  delayMinutes: number, 
  settings?: SystemSettings
): Promise<boolean> {
  const message = `⏰ DTA STUDIO - BÁO ĐỘNG TRỄ LỊCH ĐĂNG ⏰
---------------------------------------------
🎬 Video: ${videoTitle}
📺 Kênh: ${channelName}
📅 Lịch đăng dự kiến: ${scheduledTime}
⏱️ Thời gian trễ: ${delayMinutes} phút

⚠️ Vui lòng kiểm tra trạng thái video và tiến hành xuất bản ngay lập tức!
---------------------------------------------
Phát triển bởi DTA Studio - Đức Trường AI (0962.775.506)`;

  return sendZaloMessage(message.trim(), settings);
}
