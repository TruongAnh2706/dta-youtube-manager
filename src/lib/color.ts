/**
 * DTA Studio Premium Color Utility
 * Hàm đảm bảo màu sắc của tag luôn đậm, sắc nét, tương phản cực tốt với chữ màu trắng
 * và không bao giờ bị chìm/mờ nhạt trên nền trắng của trang web.
 */
export function getSafeTopicColor(colorStr: string | null | undefined): string {
  if (!colorStr) return '#008080'; // Màu mặc định: Teal đậm thương hiệu DTA
  
  // Chuẩn hóa mã hex
  let hex = colorStr.trim().replace('#', '');
  
  // Xử lý viết tắt hex (VD: FFF -> FFFFFF)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  // Nếu độ dài hex không hợp lệ, trả về màu mặc định
  if (hex.length !== 6) {
    return '#008080';
  }
  
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  
  // Tính độ sáng YIQ chuẩn quốc tế
  // Y = (R * 299 + G * 587 + B * 114) / 1000
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Ngưỡng 180 là màu bắt đầu sáng (chữ trắng trên đó sẽ khó đọc và bị chìm trên nền trắng)
  if (yiq > 180) {
    // Làm tối màu đi bằng cách giảm độ sáng của R, G, B xuống khoảng 55%
    // Giúp giữ lại tone màu gốc nhưng ở phiên bản đậm đà, rõ ràng hơn rất nhiều
    const darkR = Math.max(0, Math.floor(r * 0.55)).toString(16).padStart(2, '0');
    const darkG = Math.max(0, Math.floor(g * 0.55)).toString(16).padStart(2, '0');
    const darkB = Math.max(0, Math.floor(b * 0.55)).toString(16).padStart(2, '0');
    return `#${darkR}${darkG}${darkB}`;
  }
  
  return colorStr;
}
