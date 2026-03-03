import React, { useState } from 'react';
import { Sparkles, Copy, Check, FileText, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { useToast } from '../hooks/useToast';

interface SeoAiProps {
  geminiApiKey?: string;
}

export function SeoAi({ geminiApiKey }: SeoAiProps) {
  const { showToast } = useToast();
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [result, setResult] = useState<{ title: string; description: string; tags: string; hashtags: string; keywords: string[] } | null>(null);
  const [scriptOutline, setScriptOutline] = useState<string | null>(null);
  const [thumbnailPrompt, setThumbnailPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState<'title' | 'desc' | 'tags' | 'hashtags' | 'script' | 'thumbnail' | null>(null);

  const handleGenerate = async () => {
    if (!topic) return;

    if (!geminiApiKey) {
      showToast('Vui lòng cấu hình Gemini API Key trong phần Cài đặt trước khi sử dụng tính năng này.', 'error');
      return;
    }

    setIsGenerating(true);

    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `Bạn là một chuyên gia SEO YouTube hàng đầu. Hãy tạo bộ metadata tối ưu nhất cho một video về chủ đề: "${topic}". 
      Các từ khóa bắt buộc phải có (nếu có): "${keywords}".
      
      Trả về kết quả dưới dạng JSON với cấu trúc chính xác như sau, không có markdown formatting:
      {
        "title": "Tiêu đề video hấp dẫn, giật tít nhưng đúng sự thật (dưới 70 ký tự)",
        "description": "Đoạn mô tả chi tiết chứa từ khóa, kêu gọi hành động (Call to action), và các thông tin hữu ích",
        "tags": "tag1, tag2, tag3, tag4 (khoảng 15-20 tags cách nhau bằng dấu phẩy)",
        "hashtags": "#hashtag1 #hashtag2 #hashtag3 (khoảng 5-7 hashtags hot nhất)",
        "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3", "từ khóa 4", "từ khóa 5"]
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (text) {
        setResult(JSON.parse(text));
        showToast('Đã tạo bộ SEO thành công!', 'success');
      }
    } catch (error) {
      console.error("Error generating SEO:", error);
      showToast('Có lỗi xảy ra khi tạo SEO.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!topic) return;
    if (!geminiApiKey) {
      showToast('Vui lòng cấu hình Gemini API Key.', 'error');
      return;
    }
    setIsGeneratingScript(true);
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `Bạn là một chuyên gia biên kịch YouTube Viral. Hãy viết 1 bộ khung kịch bản (Script Outline) cho video về: "${topic}". 
      Kịch bản phải có: Hook (3s đầu), Intro, 3-5 Ý chính, Outro & CTA. Trả về định dạng Markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      setScriptOutline(response.text || 'Không có kịch bản.');
      showToast('Đã tạo kịch bản Viral thành công!', 'success');
    } catch (error) {
      showToast('Lỗi khi tạo kịch bản.', 'error');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleGenerateThumbnailPrompt = async () => {
    if (!topic) return;
    if (!geminiApiKey) {
      showToast('Vui lòng cấu hình Gemini API Key.', 'error');
      return;
    }
    setIsGeneratingThumbnail(true);
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `Bạn là chuyên gia thiết kế Thumbnail YouTube. Hãy tạo 1 prompt chi tiết để dùng cho Midjourney/DALL-E để tạo ra 1 thumbnail cực kỳ thu hút (CTR cao) cho chủ đề: "${topic}". 
      Prompt phải mô tả: Bố cục, màu sắc, cảm xúc nhân vật, text trên thumbnail. Trả về 1 đoạn văn tiếng Anh.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      setThumbnailPrompt(response.text || 'Không có prompt.');
      showToast('Đã tạo Prompt Thumbnail thành công!', 'success');
    } catch (error) {
      showToast('Lỗi khi tạo prompt thumbnail.', 'error');
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const copyToClipboard = (text: string, type: 'title' | 'desc' | 'tags' | 'hashtags' | 'script' | 'thumbnail') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Sparkles className="text-purple-500 mr-2" /> SEO & Hashtag AI
        </h1>
        <p className="text-sm text-gray-500 mt-1">Sử dụng sức mạnh của AI Studio để tự động tạo Tiêu đề, Mô tả và Tags chuẩn SEO</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề / Nội dung chính của video *</label>
            <textarea
              value={topic} onChange={e => setTopic(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              rows={3} placeholder="VD: Review điện thoại iPhone 16 Pro Max sau 1 tháng sử dụng..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Từ khóa bắt buộc (Tùy chọn)</label>
            <input
              type="text" value={keywords} onChange={e => setKeywords(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="VD: iphone 16, đánh giá, pin..."
            />
          </div>
          <button
            onClick={handleGenerate} disabled={!topic || isGenerating}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 flex justify-center items-center"
          >
            {isGenerating ? <RefreshCw size={18} className="mr-2 animate-spin" /> : <Sparkles size={18} className="mr-2" />}
            {isGenerating ? 'AI đang suy nghĩ...' : 'Tạo bộ SEO ngay'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleGenerateScript} disabled={!topic || isGeneratingScript}
              className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex justify-center items-center border border-blue-100"
            >
              {isGeneratingScript ? <RefreshCw size={14} className="mr-1 animate-spin" /> : <FileText size={14} className="mr-1" />}
              Script Outline
            </button>
            <button
              onClick={handleGenerateThumbnailPrompt} disabled={!topic || isGeneratingThumbnail}
              className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex justify-center items-center border border-emerald-100"
            >
              {isGeneratingThumbnail ? <RefreshCw size={14} className="mr-1 animate-spin" /> : <ImageIcon size={14} className="mr-1" />}
              Thumb Prompt
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          {result ? (
            <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
              <div className="bg-purple-50 px-6 py-4 border-b border-purple-100">
                <h3 className="font-semibold text-purple-900">Kết quả từ AI</h3>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Tiêu đề đề xuất</label>
                    <button onClick={() => copyToClipboard(result.title, 'title')} className="text-xs flex items-center text-purple-600 hover:text-purple-800">
                      {copied === 'title' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />} {copied === 'title' ? 'Đã copy' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-900 font-medium">
                    {result.title}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Mô tả (Description)</label>
                    <button onClick={() => copyToClipboard(result.description, 'desc')} className="text-xs flex items-center text-purple-600 hover:text-purple-800">
                      {copied === 'desc' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />} {copied === 'desc' ? 'Đã copy' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 text-sm whitespace-pre-wrap">
                    {result.description}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Tags</label>
                    <button onClick={() => copyToClipboard(result.tags, 'tags')} className="text-xs flex items-center text-purple-600 hover:text-purple-800">
                      {copied === 'tags' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />} {copied === 'tags' ? 'Đã copy' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-600 text-sm">
                    {result.tags}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Hashtags</label>
                    <button onClick={() => copyToClipboard(result.hashtags, 'hashtags')} className="text-xs flex items-center text-purple-600 hover:text-purple-800">
                      {copied === 'hashtags' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />} {copied === 'hashtags' ? 'Đã copy' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-purple-700 font-medium text-sm">
                    {result.hashtags}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Từ khóa gợi ý (Keyword Analysis)</label>
                  <div className="flex flex-wrap gap-2">
                    {result.keywords.map((kw, i) => (
                      <span key={i} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs border border-gray-200">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {scriptOutline && (
                  <div className="pt-6 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-bold text-blue-600 flex items-center">
                        <FileText size={16} className="mr-2" /> Kịch bản Viral (Script Outline)
                      </label>
                      <button onClick={() => copyToClipboard(scriptOutline, 'script')} className="text-xs flex items-center text-blue-600 hover:text-blue-800">
                        {copied === 'script' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />} {copied === 'script' ? 'Đã copy' : 'Copy'}
                      </button>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 prose prose-sm max-w-none text-blue-900">
                      <ReactMarkdown>{scriptOutline}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {thumbnailPrompt && (
                  <div className="pt-6 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-bold text-emerald-600 flex items-center">
                        <ImageIcon size={16} className="mr-2" /> Prompt Thumbnail (AI Image)
                      </label>
                      <button onClick={() => copyToClipboard(thumbnailPrompt, 'thumbnail')} className="text-xs flex items-center text-emerald-600 hover:text-emerald-800">
                        {copied === 'thumbnail' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />} {copied === 'thumbnail' ? 'Đã copy' : 'Copy'}
                      </button>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-900 text-sm italic">
                      {thumbnailPrompt}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
              <Sparkles size={48} className="mb-4 opacity-20" />
              <p>Nhập chủ đề và bấm "Tạo bộ SEO ngay" để AI hỗ trợ bạn.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
