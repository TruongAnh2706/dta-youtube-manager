import React, { useState } from 'react';
import { Compass, Lightbulb, Search, Activity, Play, TrendingUp, Key, Cpu, RefreshCw, ChevronRight, Sparkles } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useToast } from '../hooks/useToast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface NicheExplorerProps {
    youtubeApiKey: string;
    geminiApiKey?: string;
}

interface NicheIdea {
    title: string;
    difficulty: string;
    potential: string;
    keywords: string[];
    reason: string;
}

// Mockup Data for Google Trends Heatmap simulation
const MOCH_TREND_DATA = [
    { month: 'T1', volume: 4000 },
    { month: 'T2', volume: 3000 },
    { month: 'T3', volume: 2000 },
    { month: 'T4', volume: 2780 },
    { month: 'T5', volume: 1890 },
    { month: 'T6', volume: 2390 },
    { month: 'T7', volume: 3490 },
    { month: 'T8', volume: 4300 },
    { month: 'T9', volume: 5900 },
    { month: 'T10', volume: 4800 },
    { month: 'T11', volume: 3800 },
    { month: 'T12', volume: 4300 },
];

export function NicheExplorer({ youtubeApiKey, geminiApiKey }: NicheExplorerProps) {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'keyword' | 'trend' | 'ai'>('keyword');

    // Keyword Generator State
    const [keywordQuery, setKeywordQuery] = useState('');
    const [isSearchingKeyword, setIsSearchingKeyword] = useState(false);
    const [suggestedTags, setSuggestedTags] = useState<{ tag: string, count: number }[]>([]);

    // Trend Heatmap State
    const [trendQuery, setTrendQuery] = useState('');
    const [trendData, setTrendData] = useState<any[]>(MOCH_TREND_DATA);
    const [isLoadingTrend, setIsLoadingTrend] = useState(false);

    // AI Niche State
    const [nicheQuery, setNicheQuery] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [nicheIdeas, setNicheIdeas] = useState<NicheIdea[]>([]);

    // 1. YouTube + Keyword Logic
    const handleGenerateKeywords = async () => {
        if (!keywordQuery.trim()) return showToast('Vui lòng nhập từ khóa gốc', 'error');
        setIsSearchingKeyword(true);
        setSuggestedTags([]);

        try {
            // 1. Dùng YouTube Data API v3 Search -> Tìm 20 Video Top đầu
            const searchRes = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=id&q=${encodeURIComponent(keywordQuery)}&type=video&maxResults=20&order=relevance&key=${youtubeApiKey}`
            );

            const searchData = await searchRes.json();
            if (!searchRes.ok) {
                console.error("YouTube API Error Details:", searchData);
                throw new Error(searchData.error?.message || 'Lỗi truy vấn Search YouTube API');
            }
            if (!searchData.items || searchData.items.length === 0) {
                throw new Error('Từ khóa này không có video Top 1 nào.');
            }
            const videoIds = searchData.items.map((i: any) => i.id.videoId).join(',');

            // 2. Kéo Videos Data để bóc tách Tags
            const videoRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${youtubeApiKey}`
            );
            if (!videoRes.ok) throw new Error('Lỗi truy vấn Video Details API');
            const videoData = await videoRes.json();

            const tagRegex = /#[\p{L}\p{N}_]+/gu;
            const tagCount: Record<string, number> = {};

            videoData.items.forEach((item: any) => {
                // Lấy Tags chuẩn
                if (item.snippet.tags) {
                    item.snippet.tags.forEach((t: string) => {
                        const cleanTag = t.toLowerCase().trim();
                        tagCount[cleanTag] = (tagCount[cleanTag] || 0) + 1;
                    });
                }
                // Lấy Hashtag từ Title & Description
                const textToMatch = (item.snippet.title + ' ' + (item.snippet.description || '')).toLowerCase();
                const matches = textToMatch.match(tagRegex);
                if (matches) {
                    matches.forEach(ht => {
                        const cleanHt = ht.substring(1); // bỏ dấu #
                        tagCount[cleanHt] = (tagCount[cleanHt] || 0) + 1;
                    });
                }
            });

            const sortedTags = Object.entries(tagCount)
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .filter(t => t.tag.length > 2 && t.tag !== keywordQuery.toLowerCase()) // bỏ key gốc
                .slice(0, 30); // Lấy Top 30

            setSuggestedTags(sortedTags);
            showToast(`Quét xong 20 Video Top 1. Tìm thấy ${sortedTags.length} siêu từ khóa.`, 'success');

        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Lỗi xử lý Data API', 'error');
        } finally {
            setIsSearchingKeyword(false);
        }
    };

    // 2. Google Gemini - Đào Ngách Xanh Logic
    const handleAiNicheExploration = async () => {
        if (!nicheQuery.trim()) return showToast('Vui lòng nhập chủ đề khái quát muốn AI mổ xẻ.', 'error');
        if (!geminiApiKey) return showToast('Chưa cấu hình Gemini API Key System.', 'error');

        setIsAiThinking(true);
        setNicheIdeas([]);

        try {
            const ai = new GoogleGenAI({ apiKey: geminiApiKey });
            const prompt = `Bạn là một chuyên gia YouTube Marketing lão luyện chuyên đào ngách "Đại Dương Xanh" (Blue Ocean Niche).
      Chủ đề bao quát: "${nicheQuery}".
      YÊU CẦU: Hãy phân tích Chủ đề này và chẻ ra làm 3 "Ngách ngách nhỏ" (Sub-Niches) CỰC KỲ CHI TIẾT, ĐỘ CẠNH TRANH THẤP, NHƯNG THỊ HIẾU KHÁN GIẢ CAO (DỄ BẬT KIẾM TIỀN HOẶC BÁN HÀNG AFFILIATE).

      Trả về bắt buộc theo định dạng JSON Array dưới đây, không kèm nội dung khác (Mã format mảng JSON trực tiếp):
      [
        {
          "title": "Tên Ngách",
          "difficulty": "Dễ/Trung Bình/Khó",
          "potential": "Traffic cao/Traffic bán hàng siêu cấp",
          "keywords": ["key 1", "key 2", "key 3", "key 4", "key 5"],
          "reason": "Giải thích ngắn gọn 2 câu tại sao ngách này ăn tiền và ai là người xem."
        }
      ]`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.7,
                }
            });

            const text = response.text;
            if (!text) throw new Error('Không nhận được dữ liệu AI.');

            const jsonStart = text.indexOf('[');
            const jsonEnd = text.lastIndexOf(']') + 1;

            if (jsonStart === -1 || jsonEnd === 0) throw new Error('AI phản hồi sai định dạng.');

            const jsonString = text.substring(jsonStart, jsonEnd);
            const parsedData = JSON.parse(jsonString) as NicheIdea[];

            setNicheIdeas(parsedData);
            showToast('Đã khai quật được các mạch ngách mới triệu view!', 'success');

        } catch (error: any) {
            console.error(error);
            showToast('Lỗi AI Gemini: ' + error.message, 'error');
        } finally {
            setIsAiThinking(false);
        }
    };

    // 3. Trends Fetching
    const fetchTrendData = async () => {
        if (!trendQuery.trim()) return showToast('Vui lòng nhập từ khóa xem Xu hướng.', 'error');
        setIsLoadingTrend(true);
        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_BASE_URL}/api/trends?keyword=${encodeURIComponent(trendQuery)}`);
            if (!res.ok) throw new Error('Cổng Node.js lỗi. Đảm bảo bạn đã mở server.js bằng lệnh `node server.js` ở thư mục server.');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            if (data.length === 0) throw new Error('Từ khóa này quá thấp, Google không có dữ liệu 12 tháng.');
            setTrendData(data);
            showToast('Đã cào dữ liệu biểu đồ thật từ Trends API!', 'success');
        } catch (err: any) {
            showToast(err.message || 'Lỗi đọc dữ liệu Google Trends Backend', 'error');
        } finally {
            setIsLoadingTrend(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Compass className="mr-3 text-indigo-600" size={28} />
                        La Bàn Ngách (Niche Explorer)
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Sử dụng Google AI và YouTube Big Data để dò tìm mạch vàng ngách (Blue Ocean Niche)</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('keyword')}
                    className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${activeTab === 'keyword'
                        ? 'bg-white text-blue-600 ring-1 ring-blue-100'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                >
                    <Key size={16} className="mr-2" />
                    Mỏ Keyword (Dài)
                </button>
                <button
                    onClick={() => setActiveTab('ai')}
                    className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${activeTab === 'ai'
                        ? 'bg-white text-indigo-600 ring-1 ring-indigo-100'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                >
                    <Cpu size={16} className="mr-2" />
                    AI Khai Ngách
                </button>
                <button
                    onClick={() => setActiveTab('trend')}
                    className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${activeTab === 'trend'
                        ? 'bg-white text-emerald-600 ring-1 ring-emerald-100'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                >
                    <TrendingUp size={16} className="mr-2" />
                    Google Trends Heatmap
                </button>
            </div>

            {/* TABS CONTENT */}

            {/* 1. KEYWORD GENERATOR */}
            {activeTab === 'keyword' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Nhập từ khóa chủ đạo (Seed Keyword)</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={keywordQuery}
                                    onChange={e => setKeywordQuery(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleGenerateKeywords()}
                                    placeholder="VD: Nuôi bò sát cảnh, Chó poodle bị hôi..."
                                    className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={handleGenerateKeywords}
                                disabled={isSearchingKeyword}
                                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-xl flex items-center justify-center font-bold transition-colors shadow-md shadow-blue-200"
                            >
                                {isSearchingKeyword ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Search className="mr-2" size={18} />}
                                Cào Từ Khóa Top 20 Video
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 min-h-[300px]">
                        {isSearchingKeyword ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10">
                                <RefreshCw size={40} className="animate-spin mb-4 text-blue-500" />
                                <p className="font-semibold text-slate-600">Hệ thống đang quét Data từ YouTube API...</p>
                                <p className="text-xs mt-2">Bóc tách Tags + Lọc Hashtag Title + Lọc Hashtag Description từ 20 Videos Rank Top 1.</p>
                            </div>
                        ) : suggestedTags.length > 0 ? (
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center">
                                    <TrendingUp size={16} className="text-blue-500 mr-2" /> Cụm từ khóa Đuôi Dài (Lặp lại cao ở các Clip Top 1)
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {suggestedTags.map((tagObj, i) => (
                                        <div key={i} className="flex items-center px-4 py-2 bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm rounded-lg cursor-pointer transition-all group">
                                            <span className="text-sm font-medium text-slate-800">{tagObj.tag}</span>
                                            <span className="ml-2 text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">x{tagObj.count}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 flex justify-end">
                                    <button className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">
                                        Copy toàn bộ làm Tags Video
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10 opacity-70">
                                <Key size={48} className="mb-4 text-slate-300" />
                                <p>Nhập từ khóa ngắn và ấn nút Quét để trích lục Big Data YouTube.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 2. AI NICHE FINDER (GEMINI) */}
            {activeTab === 'ai' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">Chủ đề rộng (Broad Niche)</label>
                            <div className="relative">
                                <Lightbulb size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                                <input
                                    type="text"
                                    value={nicheQuery}
                                    onChange={e => setNicheQuery(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleAiNicheExploration()}
                                    placeholder="VD: Em muốn làm kênh về du lịch núi, Phân tích cho em các kênh dạy làm bánh..."
                                    className="w-full border border-indigo-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={handleAiNicheExploration}
                                disabled={isAiThinking}
                                className="w-full md:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl flex items-center justify-center font-bold transition-all shadow-md shadow-indigo-200"
                            >
                                {isAiThinking ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Cpu className="mr-2" size={18} />}
                                Đào "Đại Dương Xanh" Bằng AI
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {isAiThinking ? (
                            <div className="col-span-3 flex flex-col items-center justify-center min-h-[400px] bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                <div className="relative">
                                    <Cpu size={60} className="text-indigo-400 p-3 rounded-full bg-indigo-100 mb-4 animate-pulse" />
                                    <RefreshCw size={24} className="text-indigo-600 absolute bottom-3 right-0 animate-spin bg-white rounded-full p-1" />
                                </div>
                                <h3 className="text-lg font-bold text-indigo-900 mb-2">Google AI đang quét Hàng Triệu Dữ Liệu...</h3>
                                <p className="text-sm text-indigo-600">Đang phân tích tâm lý đám đông và khoảng trống thị trường (Gap).</p>
                            </div>
                        ) : nicheIdeas.length > 0 ? (
                            nicheIdeas.map((niche, index) => (
                                <div key={index} className="bg-white rounded-xl border border-indigo-100 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group flex flex-col">
                                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 border-b border-indigo-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2 py-1 rounded">Sub-Niche #{index + 1}</span>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded text-white ${niche.difficulty === 'Dễ' ? 'bg-emerald-500' : niche.difficulty === 'Trung Bình' ? 'bg-amber-500' : 'bg-rose-500'}`}>{niche.difficulty}</span>
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-lg leading-tight">{niche.title}</h4>
                                        <div className="mt-2 text-xs font-medium text-emerald-600 flex items-center">
                                            <Activity size={12} className="mr-1" /> {niche.potential}
                                        </div>
                                    </div>

                                    <div className="p-4 flex-1 flex flex-col">
                                        <p className="text-sm text-gray-600 mb-4 italic flex-1"><span className="text-indigo-400 font-serif font-black text-xl mr-1">"</span>{niche.reason}</p>

                                        <div className="mt-auto">
                                            <div className="text-[10px] uppercase font-bold text-gray-400 mb-2">TOP 5 TỪ KHÓA BẮT BUỘC DÙNG (KEY CHÍNH):</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {niche.keywords.map((k, i) => (
                                                    <span key={i} className="text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200">
                                                        {k}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-gray-50 border-t border-gray-100">
                                        <button className="w-full text-indigo-600 text-xs font-bold flex items-center justify-center hover:text-indigo-800 transition-colors">
                                            Tạo Chủ đề (Topic) Từ Ngách Này <ChevronRight size={14} className="ml-1" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-3 flex flex-col items-center justify-center min-h-[400px] border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-200 mb-4">
                                    <Sparkles className="text-indigo-400" size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Truyền cảm hứng (Brainstorming)</h3>
                                <p className="text-sm text-gray-500 max-w-sm text-center">
                                    Bạn bí ý tưởng lập kênh mới? Hãy đưa cho AI 1 ý niệm chung chung (VD: "Đồ chơi trẻ em"), AI sẽ bóc tách nó thành 3 ngách ngách siêu nhỏ mà Bố mẹ chịu chi tiền nhất.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. TRENDING HEATMAP FOR UI VERIFICATION (NOW ACTIVE) */}
            {activeTab === 'trend' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Nhập từ khóa theo dõi xu hướng 12 Tháng qua</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={trendQuery}
                                    onChange={e => setTrendQuery(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && fetchTrendData()}
                                    placeholder="VD: Nuôi chó poodle, Học tiếng trung..."
                                    className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={fetchTrendData}
                                disabled={isLoadingTrend}
                                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-6 py-3 rounded-xl flex items-center justify-center font-bold transition-colors shadow-md shadow-emerald-200"
                            >
                                {isLoadingTrend ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Search className="mr-2" size={18} />}
                                Lập Biểu Đồ Thật
                            </button>
                        </div>
                    </div>

                    <div className="w-full h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={trendData}
                                margin={{
                                    top: 20,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#ecfdf5' }}
                                    contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Bar dataKey="volume" name="Lưu lượng Truy cập" fill={trendData === MOCH_TREND_DATA ? "#e5e7eb" : "#34d399"} radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {trendData === MOCH_TREND_DATA && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start text-sm">
                            <div className="mr-3 mt-1 text-amber-500"><Lightbulb size={18} /></div>
                            <div className="text-amber-800">
                                <strong>Dữ liệu chưa có thật:</strong> Biểu đồ đang hiển thị Demo UI. Gõ một từ khoá và ấn "Lập Biểu Đồ Thật" để lấy số liệu thực tế từ Google API qua cổng Local Backend NodeJS của bạn.
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
