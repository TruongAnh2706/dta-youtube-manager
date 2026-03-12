import { GoogleGenAI, Type } from "@google/genai";
import { Topic } from "../types";

export async function analyzeChannelTopic(
  channelName: string,
  description: string,
  existingTopics: Topic[],
  apiKey: string
): Promise<{ suggestedTopicIds: string[], newTopics: { name: string, color: string }[] }> {
  if (!apiKey) {
    throw new Error("Gemini API Key chưa được cấu hình.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Phân tích kênh YouTube sau để xác định chủ đề phù hợp nhất.
    Tên kênh: ${channelName}
    Mô tả: ${description}

    Danh sách chủ đề hiện có:
    ${existingTopics.map(t => `- ID: ${t.id}, Tên: ${t.name}`).join('\n')}

    Yêu cầu:
    1. Chọn tối đa 3 ID chủ đề phù hợp nhất từ danh sách hiện có.
    2. Nếu không có chủ đề nào phù hợp trong danh sách, hãy đề xuất tối đa 2 chủ đề mới (tên ngắn gọn, súc tích).
    3. Trả về kết quả dưới dạng JSON.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedTopicIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Mảng chứa các ID chủ đề hiện có phù hợp"
          },
          newTopics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Tên chủ đề mới" },
                color: { type: Type.STRING, description: "Mã màu HEX ngẫu nhiên phù hợp (VD: #EF4444)" }
              },
              required: ["name", "color"]
            },
            description: "Mảng chứa các chủ đề mới đề xuất"
          }
        },
        required: ["suggestedTopicIds", "newTopics"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Lỗi parse JSON từ AI:", e);
    return { suggestedTopicIds: [], newTopics: [] };
  }
}

export async function generateScriptOutline(
  title: string,
  channelName: string,
  notes: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Gemini API Key chưa được cấu hình.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Hãy viết một bản outline kịch bản chi tiết cho video YouTube sau:
    Tiêu đề: ${title}
    Kênh: ${channelName}
    Ghi chú bổ sung: ${notes}

    Yêu cầu:
    1. Outline bao gồm: Hook (mở đầu), Các luận điểm chính, và Call to Action (kêu gọi hành động).
    2. Văn phong phù hợp với nội dung YouTube.
    3. Trình bày dưới dạng Markdown.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "Không thể tạo kịch bản lúc này.";
}

export async function performDeepAnalysis(
  topicName: string,
  ourChannels: any[],
  sourceChannels: any[],
  apiKey: string,
  staffCount: number = 0
): Promise<string[]> {
  if (!apiKey) {
    throw new Error("Gemini API Key chưa được cấu hình.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Bạn là chuyên gia chiến lược nội dung YouTube. Hãy phân tích dữ liệu sau về chủ đề "${topicName}" và đưa ra 5 ý tưởng/nhiệm vụ chiến lược cụ thể để giao cho nhân sự ngay lập tức.

    Dữ liệu kênh của chúng ta:
    ${ourChannels.map(c => `- ${c.name}: ${c.subscribers} subs`).join('\n')}

    Dữ liệu kênh nguồn/đối thủ tham khảo:
    ${sourceChannels.map(c => `- ${c.name}: ~${c.averageViews} views/video, Rating: ${c.rating}/5`).join('\n')}

    Nguồn lực hiện tại: ${staffCount} nhân sự trực tuyến/sẵn sàng.
    
    Yêu cầu:
    1. Đưa ra các ý tưởng nhiệm vụ (actionable tasks) cụ thể để nhân viên có thể làm theo (VD: "Phân tích 3 video viral nhất của kênh X và lên kịch bản shorts tương tự").
    2. Gợi ý cụ thể định dạng (Long-form/Shorts) khai thác nhược điểm đối thủ.
    3. Hạn chế lý thuyết suông, tập trung vào thực thi cho đội Video/Content.
    4. Trả về mảng JSON chứa 5 chuỗi văn bản, mỗi chuỗi là 1 lời khuyên/hành động dài khoảng 1-2 câu.
    5. TUYỆT ĐỐI không dùng định dạng markdown, chỉ trả JSON.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Lỗi parse JSON phân tích:", e);
    return ["Không thể phân tích dữ liệu lúc này. Vui lòng thử lại sau."];
  }
}
