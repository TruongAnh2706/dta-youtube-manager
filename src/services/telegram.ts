import { SystemSettings } from '../types';

/**
 * Gửi tin nhắn đến Telegram Bot
 */
export async function sendTelegramMessage(message: string, settings?: SystemSettings): Promise<boolean> {
  const token = settings?.telegramBotToken;
  const chatId = settings?.telegramChatId;
  const enabled = settings?.telegramEnabled;

  if (!enabled || !token || !chatId) {
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram Send Error:', data.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Telegram Request Error:', error);
    return false;
  }
}

/**
 * Gửi cảnh báo Proxy bị lỗi (Die)
 */
export async function sendProxyAlert(proxyIp: string, proxyPort: string, notes: string, settings?: SystemSettings): Promise<boolean> {
  const message = `
🚨 <b>DTA STUDIO - BÁO ĐỘNG HỆ THỐNG</b> 🚨
---------------------------------------------
🔌 <b>Sự cố:</b> Proxy mất kết nối (DEAD)!
💻 <b>IP:</b> <code>${proxyIp}:${proxyPort}</code>
📝 <b>Ghi chú:</b> <i>${notes || 'Không có ghi chú'}</i>
⏰ <b>Thời gian phát hiện:</b> ${new Date().toLocaleString('vi-VN')}

⚠️ <i>Vui lòng truy cập DTA YouTube Manager để kiểm tra hoặc cấu hình Proxy mới để đảm bảo các kênh chạy an toàn!</i>
---------------------------------------------
Phát triển bởi <b>DTA Studio</b> - Đức Trường AI (0962.775.506)
`;
  return sendTelegramMessage(message.trim(), settings);
}

/**
 * Gửi cảnh báo có Gậy bản quyền mới
 */
export async function sendStrikeAlert(channelName: string, strikeType: 'copyright' | 'community', details: string, expirationDate: string, settings?: SystemSettings): Promise<boolean> {
  const typeLabel = strikeType === 'copyright' ? '🔴 Gậy bản quyền (Copyright Strike)' : '🟡 Cảnh cáo nguyên tắc cộng đồng (Community Strike)';
  const message = `
🚨 <b>DTA STUDIO - CẢNH BÁO BẢN QUYỀN</b> 🚨
---------------------------------------------
📢 <b>Kênh nhận gậy:</b> <b>${channelName}</b>
⚠️ <b>Loại vi phạm:</b> ${typeLabel}
📝 <b>Chi tiết:</b> <i>${details || 'Không có chi tiết'}</i>
📅 <b>Ngày hết hạn dự kiến:</b> ${expirationDate || 'Không rõ'}
⏰ <b>Thời gian ghi nhận:</b> ${new Date().toLocaleString('vi-VN')}

🤖 <i>Hệ thống DTA AI Appeal Writer đã sẵn sàng viết thư kháng cáo chuẩn pháp lý Hoa Kỳ cho gậy này!</i>
---------------------------------------------
Phát triển bởi <b>DTA Studio</b> - Đức Trường AI (0962.775.506)
`;
  return sendTelegramMessage(message.trim(), settings);
}

/**
 * Gửi cảnh báo trễ lịch đăng video
 */
export async function sendScheduleDelayAlert(videoTitle: string, channelName: string, scheduledTime: string, delayMinutes: number, settings?: SystemSettings): Promise<boolean> {
  const message = `
⏰ <b>DTA STUDIO - BÁO ĐỘNG TRỄ LỊCH ĐĂNG</b> ⏰
---------------------------------------------
🎬 <b>Video:</b> <b>${videoTitle}</b>
📺 <b>Kênh:</b> <i>${channelName}</i>
📅 <b>Lịch đăng dự kiến:</b> <code>${scheduledTime}</code>
⏱️ <b>Thời gian trễ:</b> <b>${delayMinutes} phút</b>

⚠️ <i>Vui lòng kiểm tra trạng thái video trong Tab Công việc để tiến hành xuất bản ngay lập tức!</i>
---------------------------------------------
Phát triển bởi <b>DTA Studio</b> - Đức Trường AI (0962.775.506)
`;
  return sendTelegramMessage(message.trim(), settings);
}
