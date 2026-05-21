// DTA Studio TOTP Service - Phát triển bởi Đức Trường AI
// Sinh mã OTP 2FA 6 chữ số thời gian thực sử dụng Web Crypto API (100% Offline & Bảo mật)

function base32tohex(base32: string): string {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let hex = "";
  
  // Loại bỏ khoảng trắng và đổi thành chữ hoa
  const cleanBase32 = base32.replace(/[\s-]/g, "").toUpperCase();

  for (let i = 0; i < cleanBase32.length; i++) {
    const val = base32chars.indexOf(cleanBase32.charAt(i));
    if (val === -1) continue; // Bỏ qua ký tự không hợp lệ
    bits += leftpad(val.toString(2), 5, '0');
  }

  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substr(i, 4);
    hex = hex + parseInt(chunk, 2).toString(16);
  }
  return hex;
}

function leftpad(str: string, len: number, pad: string): string {
  if (len + 1 >= str.length) {
    str = Array(len + 1 - str.length).join(pad) + str;
  }
  return str;
}

function hex2buf(hex: string): ArrayBuffer {
  const view = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    view[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return view.buffer;
}

/**
 * Sinh mã OTP 6 chữ số thời gian thực từ Secret Key 2FA
 * @param secret Khóa bí mật 2FA (chuỗi Base32)
 */
export async function generateTOTP(secret: string): Promise<{ otp: string; secondsLeft: number }> {
  try {
    if (!secret || secret.trim().length < 4) {
      return { otp: "", secondsLeft: 0 };
    }

    // Nếu secret chứa khoảng trắng hoặc có định dạng của backup code (chỉ là số thuần), bỏ qua không tính TOTP
    const cleanSecret = secret.replace(/[\s-]/g, "");
    if (/^\d+$/.test(cleanSecret)) {
      return { otp: "", secondsLeft: 0 }; // Đây là mã backup code, không phải TOTP secret
    }

    const keyHex = base32tohex(cleanSecret);
    if (!keyHex || keyHex.length % 2 !== 0) return { otp: "", secondsLeft: 0 };

    const epoch = Math.round(new Date().getTime() / 1000);
    const time = leftpad(Math.floor(epoch / 30).toString(16), 16, '0');
    const secondsLeft = 30 - (epoch % 30);

    const keyBuf = hex2buf(keyHex);
    const timeBuf = hex2buf(time);

    // Sử dụng Web Crypto API để tính HMAC-SHA1
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBuf,
      { name: "HMAC", hash: { name: "SHA-1" } },
      false,
      ["sign"]
    );

    const signature = await window.crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      timeBuf
    );

    const hmacView = new Uint8Array(signature);
    const offset = hmacView[hmacView.length - 1] & 0xf;
    
    const binary =
      ((hmacView[offset] & 0x7f) << 24) |
      ((hmacView[offset + 1] & 0xff) << 16) |
      ((hmacView[offset + 2] & 0xff) << 8) |
      (hmacView[offset + 3] & 0xff);

    let otp = (binary % 1000000).toString();
    while (otp.length < 6) {
      otp = "0" + otp;
    }

    return { otp, secondsLeft };
  } catch (error) {
    console.error("DTA TOTP Error:", error);
    return { otp: "", secondsLeft: 0 };
  }
}

/**
 * Kiểm tra xem chuỗi nhập vào có khả năng là khóa bí mật 2FA (Base32) hay không
 */
export function isValid2FASecret(secret: string): boolean {
  if (!secret) return false;
  const clean = secret.replace(/[\s-]/g, "");
  // Khóa bí mật 2FA thường là chuỗi chữ từ A-Z và số từ 2-7, độ dài >= 8 ký tự
  return /^[A-Z2-7]{8,64}$/i.test(clean);
}
