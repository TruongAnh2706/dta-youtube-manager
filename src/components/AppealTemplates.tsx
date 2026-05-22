import React, { useState, useMemo } from 'react';
import { Sparkles, Copy, Check, Plus, Edit2, Trash2, Search, X, FileText, HelpCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { AppealTemplate, StaffRole } from '../types';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';

interface AppealTemplatesProps {
  appealTemplates: AppealTemplate[];
  setAppealTemplates: React.Dispatch<React.SetStateAction<AppealTemplate[]>>;
  geminiApiKey?: string;
  currentUser: { id: string; role: StaffRole; name: string } | null;
}

export function AppealTemplates({
  appealTemplates,
  setAppealTemplates,
  geminiApiKey,
  currentUser
}: AppealTemplatesProps) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // States cho modal Thêm/Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AppealTemplate | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'Khác'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States cho tính năng AI Viết Lại
  const [isAiGenerating, setIsAiGenerating] = useState<string | null>(null); // Lưu ID của template đang spin
  const [aiResult, setAiResult] = useState<{ templateId: string; content: string } | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Copy states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAi, setCopiedAi] = useState(false);

  // Kiểm tra quyền Admin
  const hasEditPermission = useMemo(() => {
    return currentUser?.role === 'admin';
  }, [currentUser]);

  // Lọc danh mục duy nhất
  const categories = useMemo(() => {
    const cats = new Set(appealTemplates.map(t => t.category));
    return ['all', ...Array.from(cats)];
  }, [appealTemplates]);

  // Bộ lọc tìm kiếm & danh mục
  const filteredTemplates = useMemo(() => {
    return appealTemplates.filter(t => {
      const matchSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'all' || t.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [appealTemplates, searchTerm, selectedCategory]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Đã sao chép văn bản vào bộ nhớ tạm!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAiResult = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult.content);
    setCopiedAi(true);
    showToast('Đã sao chép văn bản kháng viết lại bằng AI!', 'success');
    setTimeout(() => setCopiedAi(false), 2000);
  };


  // Tính năng AI viết lại mẫu kháng (Gemini API)
  const handleAiRewrite = async (template: AppealTemplate) => {
    if (!geminiApiKey) {
      showToast('Vui lòng cấu hình Gemini API Key trong phần Hệ thống > Cài đặt API trước khi dùng.', 'error');
      return;
    }

    setIsAiGenerating(template.id);
    showToast('Đang sử dụng Gemini AI viết lại mẫu kháng nghị...', 'info');

    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `Bạn là một luật sư chuyên nghiệp và chuyên gia xử lý kháng nghị tài khoản/kênh YouTube bị khóa, vi phạm chính sách của Google.
Hãy viết lại (spin/rewrite) mẫu đơn kháng nghị sau đây thành một văn bản mới hoàn toàn độc bản, không trùng lặp cấu trúc hay từ ngữ với bản cũ, nhưng vẫn giữ nguyên lý do kháng nghị cốt lõi và các lập luận thuyết phục.
Văn bản kháng mới phải có giọng điệu chuyên nghiệp, lịch sự, khẩn khoản nhưng đanh thép pháp lý để tăng tỷ lệ được duyệt cao nhất.

Yêu cầu cực kỳ quan trọng về định dạng văn bản:
1. TUYỆT ĐỐI KHÔNG bọc văn bản trong bất kỳ thẻ block code markdown nào (KHÔNG dùng \`\`\`markdown hay \`\`\`). Chỉ xuất ra văn bản thô (Plain Text) định dạng các đoạn văn rõ ràng.
2. TUYỆT ĐỐI KHÔNG sử dụng bất kỳ ký tự định dạng Markdown đặc biệt nào như in đậm (**), in nghiêng (*), gạch chân (_), tiêu đề (#, ##, ###), trích dẫn (>). Toàn bộ nội dung phải là chữ viết thường và hoa thuần túy (Plain Text) để có thể copy trực tiếp dùng luôn. Ví dụ: Hãy viết "Subject: Kháng nghị..." thay vì "**Subject:** Kháng nghị...".
3. TUYỆT ĐỐI KHÔNG kèm theo bất kỳ câu chào, câu dẫn, lời giới thiệu hay lời kết giải thích nào của AI (Ví dụ: KHÔNG viết "Dưới đây là...", "Here is...", "Hy vọng bản này giúp ích...").
4. Trực tiếp bắt đầu văn bản bằng lời chào chính thức của lá đơn (Ví dụ: "Dear Google Support Team,..." hoặc "Kính gửi Ban hỗ trợ YouTube,...") và kết thúc bằng lời chào ký tên (Ví dụ: "Sincerely,...").
5. Nếu mẫu gốc bằng tiếng Anh, viết lại bằng tiếng Anh cực chuẩn (giọng văn người bản xứ Mỹ). Nếu mẫu gốc bằng tiếng Việt, viết lại bằng tiếng Việt cực kỳ lưu loát, chuẩn mực.
6. Chừa trống hoặc đánh dấu [Tên Kênh của bạn / Your Channel Name] ở những nơi cần điền thông tin cụ thể để nhân sự dễ điền.

Mẫu đơn gốc cần viết lại:
"""
${template.content}
"""`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const rewrittenText = response.text;
      if (rewrittenText) {
        // ------------------ FRONTEND SANITIZER (BỘ LỌC LÀM SẠCH CHẤT LƯỢNG CAO CHUYÊN SÂU) ------------------
        let cleanedText = rewrittenText.trim();
        
        // 1. Loại bỏ tất cả các khối bọc code block ```markdown ... ``` nếu AI cố tình trả về ở bất cứ đâu
        cleanedText = cleanedText.replace(/```[a-zA-Z]*\n?/gi, '');
        cleanedText = cleanedText.replace(/```/g, '');
        
        // 2. Loại bỏ các ký tự in đậm markdown **Text** chuyển thành Text
        cleanedText = cleanedText.replace(/\*\*(.*?)\*\*/g, '$1');
        
        // 3. Loại bỏ ký tự in nghiêng markdown *Text* hoặc _Text_ chuyển thành Text
        cleanedText = cleanedText.replace(/\*(.*?)\*/g, '$1');
        cleanedText = cleanedText.replace(/_(.*?)_/g, '$1');
        
        // 4. Loại bỏ ký tự tiêu đề markdown ở đầu dòng (ví dụ: ### Tiêu đề -> Tiêu đề, ## Tiêu đề -> Tiêu đề)
        cleanedText = cleanedText.replace(/^#+\s+/gm, '');

        // 5. Loại bỏ ký tự blockquote markdown ở đầu dòng (ví dụ: > Text -> Text)
        cleanedText = cleanedText.replace(/^>\s+/gm, '');
        
        // 6. Loại bỏ tất cả các dấu huyền bao quanh text dạng `code`
        cleanedText = cleanedText.replace(/`(.*?)`/g, '$1');
        
        // 7. Loại bỏ các lời chào dẫn đầu thừa thãi của AI (quét sâu nhiều định dạng)
        const prefixPatterns = [
          /^(dưới đây là|đây là|bản viết lại|mẫu kháng nghị đã viết lại|sau đây là|chắc chắn rồi, dưới đây là|tôi đã viết lại|đây là bản dịch|đây là bản spin)[^\n:]*:\s*/i,
          /^(here is|here's|below is|sure, here is|certainly, here is|here is the rewritten|i have rewritten|this is the rewritten|the rewritten version)[^\n:]*:\s*/i,
          /^(dưới đây là|đây là|bản viết lại|mẫu kháng nghị đã viết lại|sau đây là|chắc chắn rồi, dưới đây là|tôi đã viết lại|đây là bản dịch|đây là bản spin)[^\n]*\n/i,
          /^(here is|here's|below is|sure, here is|certainly, here is|here is the rewritten|i have rewritten|this is the rewritten|the rewritten version)[^\n]*\n/i
        ];
        
        for (const pattern of prefixPatterns) {
          cleanedText = cleanedText.replace(pattern, '');
        }
        
        // 8. Loại bỏ lời bình luận kết luận của AI ở cuối chuỗi nếu có
        const suffixPatterns = [
          /\s*(hy vọng bản viết lại|hy vọng mẫu đơn|chúc bạn|mong rằng|hi vọng|chúc bạn thành công)[^\n]*$/i,
          /\s*(i hope this helps|hope this rewritten|hope this helps|good luck|let me know|hope you get your)[^\n]*$/i
        ];
        
        for (const pattern of suffixPatterns) {
          cleanedText = cleanedText.replace(pattern, '');
        }

        cleanedText = cleanedText.trim();
        // -----------------------------------------------------------------------------------------

        setAiResult({
          templateId: template.id,
          content: cleanedText
        });
        setIsAiModalOpen(true);
        showToast('AI đã viết lại mẫu kháng thành công!', 'success');
      } else {
        showToast('AI trả về kết quả trống, vui lòng thử lại.', 'warning');
      }
    } catch (error: any) {
      console.error("AI Rewrite error:", error);
      showToast(`Không thể viết lại bằng AI: ${error.message || 'Lỗi kết nối API'}`, 'error');
    } finally {
      setIsAiGenerating(null);
    }
  };

  // Mở modal thêm mới
  const handleOpenAddModal = () => {
    setEditingTemplate(null);
    setFormData({
      title: '',
      content: '',
      category: 'Khác'
    });
    setIsModalOpen(true);
  };

  // Mở modal chỉnh sửa
  const handleOpenEditModal = (template: AppealTemplate) => {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      content: template.content,
      category: template.category
    });
    setIsModalOpen(true);
  };

  // Submit Thêm / Sửa
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) {
      showToast('Vui lòng điền đầy đủ tiêu đề và nội dung!', 'warning');
      return;
    }

    setIsSubmitting(true);
    const today = new Date().toISOString();

    try {
      if (editingTemplate) {
        // Chỉnh sửa
        const { error } = await supabase
          .from('appeal_templates')
          .update({
            title: formData.title,
            content: formData.content,
            category: formData.category,
            updated_at: today
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;

        setAppealTemplates(prev =>
          prev.map(t =>
            t.id === editingTemplate.id
              ? { ...t, title: formData.title, content: formData.content, category: formData.category, updatedAt: today }
              : t
          )
        );
        showToast('Đã cập nhật mẫu kháng nghị thành công!', 'success');
      } else {
        // Thêm mới
        const newId = crypto.randomUUID();
        const { error } = await supabase
          .from('appeal_templates')
          .insert([{
            id: newId,
            title: formData.title,
            content: formData.content,
            category: formData.category,
            created_at: today,
            updated_at: today
          }]);

        if (error) throw error;

        const newTemplate: AppealTemplate = {
          id: newId,
          title: formData.title,
          content: formData.content,
          category: formData.category,
          createdAt: today,
          updatedAt: today
        };

        setAppealTemplates(prev => [...prev, newTemplate]);
        showToast('Đã thêm mẫu kháng nghị mới thành công!', 'success');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      showToast(`Lỗi thao tác CSDL: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xóa mẫu kháng gốc
  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mẫu kháng gốc này không? Thao tác này không thể hoàn tác!')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('appeal_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAppealTemplates(prev => prev.filter(t => t.id !== id));
      showToast('Đã xóa mẫu kháng nghị thành công!', 'success');
    } catch (error: any) {
      showToast(`Không thể xóa mẫu kháng: ${error.message}`, 'error');
    }
  };

  // Helper trả về màu sắc tag danh mục bắt mắt trên nền sáng (Light Mode compatible)
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Tài khoản Google': return 'bg-orange-50 text-orange-600 border border-orange-200';
      case 'Tài khoản YouTube': return 'bg-red-50 text-red-600 border border-red-200';
      case 'Kênh YouTube': return 'bg-rose-50 text-rose-600 border border-rose-200';
      case 'Xác minh danh tính': return 'bg-blue-50 text-blue-600 border border-blue-200';
      case 'Chính sách YouTube': return 'bg-purple-50 text-purple-600 border border-purple-200';
      case 'Nguyên tắc cộng đồng': return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
      default: return 'bg-cyan-50 text-cyan-600 border border-cyan-200';
    }
  };

  return (
    <div className="space-y-6 text-gray-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="text-cyan-500 animate-pulse" /> KHO MẪU KHÁNG NGHỊ
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Hệ thống quản lý mẫu kháng nghị chuẩn. Nhân viên có thể xem, copy hoặc bấm **AI Viết Lại** để tạo mẫu mới không trùng lặp dùng ngay.
          </p>
        </div>
        
        {hasEditPermission && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-gradient-to-r from-[#00ffff] to-[#00bfff] hover:from-[#00e6e6] hover:to-[#00a3cc] text-slate-900 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-[0_4px_12px_rgba(0,255,255,0.25)] transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={14} strokeWidth={3} /> THÊM MẪU KHÁNG
          </button>
        )}
      </div>

      {/* Lọc & Tìm kiếm */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* Tìm kiếm */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Tìm theo tiêu đề, nội dung..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-gray-700 placeholder-gray-400 shadow-sm"
          />
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Danh mục lọc */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold border transition-all uppercase tracking-wider ${
                selectedCategory === cat
                  ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {cat === 'all' ? 'TẤT CẢ' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Danh sách các card mẫu */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white border border-dashed border-gray-300 rounded-2xl text-center shadow-sm">
          <div className="bg-gray-50 w-14 h-14 rounded-full flex items-center justify-center mb-4 border border-gray-100">
            <HelpCircle size={28} className="text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Chưa có mẫu kháng nghị nào được tạo</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            {hasEditPermission 
              ? 'Hãy click vào nút "THÊM MẪU KHÁNG" ở góc phải phía trên để bắt đầu cập nhật mẫu kháng gốc đầu tiên của bạn.' 
              : 'Hiện tại chưa có mẫu kháng nào được cập nhật trên hệ thống. Vui lòng liên hệ Admin.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className="bg-white border border-gray-200 hover:border-cyan-400/60 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-[0_4px_20px_rgba(0,255,255,0.06)] relative group"
            >
              <div>
                {/* Header card */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mb-2 ${getCategoryColor(template.category)}`}>
                      {template.category}
                    </span>
                    <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {template.title}
                    </h3>
                  </div>
                  
                  {/* Nút hành động cho Admin */}
                  {hasEditPermission && (
                    <div className="flex items-center gap-1.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEditModal(template)}
                        title="Chỉnh sửa mẫu gốc"
                        className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md text-yellow-600 transition-all hover:scale-105"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        title="Xóa mẫu gốc"
                        className="p-1.5 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-md text-red-500 transition-all hover:scale-105"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Nội dung mẫu kháng gốc */}
                <div className="relative mt-2">
                  <div className="bg-[#f8fafc] border border-gray-200/60 rounded-lg p-3.5 h-44 overflow-y-auto custom-scrollbar font-mono text-[11px] text-gray-600 whitespace-pre-wrap select-all leading-relaxed">
                    {template.content}
                  </div>
                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-90 hover:opacity-100">
                    <button
                      onClick={() => handleCopy(template.content, template.id)}
                      title="Copy mẫu gốc"
                      className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-250 text-gray-600 hover:text-gray-800 rounded text-[10px] font-bold transition-all shadow-sm"
                    >
                      {copiedId === template.id ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                      {copiedId === template.id ? 'Đã Copy' : 'Copy Gốc'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer card: AI Viết Lại */}
              <div className="border-t border-gray-100 mt-4 pt-4 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-mono">
                  Dùng AI spin chống quét trùng lặp
                </span>
                
                <button
                  onClick={() => handleAiRewrite(template)}
                  disabled={isAiGenerating !== null}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-[#00ffff]/10 hover:from-blue-100 hover:to-[#00ffff]/20 border border-cyan-400/40 text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm"
                >
                  {isAiGenerating === template.id ? (
                    <RefreshCw size={11} className="animate-spin text-blue-500" />
                  ) : (
                    <Sparkles size={11} className="text-blue-500" />
                  )}
                  {isAiGenerating === template.id ? 'AI Đang viết...' : 'AI Viết Lại (1 Lần)'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL THÊM / SỬA MẪU GỐC */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                <FileText className="text-cyan-500" size={16} />
                {editingTemplate ? 'CHỈNH SỬA MẪU KHÁNG GỐC' : 'THÊM MẪU KHÁNG GỐC MỚI'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {/* Tiêu đề & Danh mục */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tiêu đề mẫu kháng *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="VD: Kháng lách luật mánh khóe..."
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-gray-700 placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Danh mục *</label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-gray-700 cursor-pointer"
                    >
                      <option value="Tài khoản Google">Tài khoản Google</option>
                      <option value="Tài khoản YouTube">Tài khoản YouTube</option>
                      <option value="Kênh YouTube">Kênh YouTube</option>
                      <option value="Xác minh danh tính">Xác minh danh tính</option>
                      <option value="Chính sách YouTube">Chính sách YouTube</option>
                      <option value="Nguyên tắc cộng đồng">Nguyên tắc cộng đồng</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>

                {/* Nội dung */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Nội dung mẫu gốc *</label>
                    <span className="text-[10px] text-gray-400">Giữ nguyên văn mẫu cốt lõi nhất</span>
                  </div>
                  <textarea
                    required
                    value={formData.content}
                    onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    rows={10}
                    placeholder="Nhập nội dung mẫu văn kháng gốc tại đây..."
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-xs focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-gray-700 placeholder-gray-400 font-mono leading-relaxed"
                  />
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-bold transition-all"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#00ffff] to-[#00bfff] text-slate-900 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw size={13} className="animate-spin" /> : null}
                  {isSubmitting ? 'ĐANG LƯU...' : 'LƯU LẠI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KẾT QUẢ AI VIẾT LẠI (DÙNG 1 LẦN RỒI HỦY) */}
      {isAiModalOpen && aiResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
              <h2 className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-500 animate-pulse" /> MẪU KHÁNG ĐÃ ĐƯỢC AI VIẾT LẠI ĐỘC BẢN
              </h2>
              <button
                onClick={() => {
                  setIsAiModalOpen(false);
                  setAiResult(null); // Giải phóng bộ nhớ, hủy bản cũ đúng yêu cầu
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Đóng & Xóa bản nháp này"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-250 text-blue-600 rounded-lg text-[11px]">
                <AlertCircle size={14} className="shrink-0 text-blue-500" />
                <span>
                  <strong>Lưu ý quan trọng:</strong> Bản viết lại này được tạo ngẫu nhiên bằng AI để tránh quét trùng lặp hệ thống. Bản này <strong>SẼ KHÔNG ĐƯỢC LƯU</strong> trong CSDL. Vui lòng bấm nút <strong>Copy Kết Quả AI</strong> ngay bên dưới để sử dụng. Sau khi bạn đóng modal này, bản này sẽ biến mất vĩnh viễn!
                </span>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nội dung spin độc bản:</span>
                  <span className="text-[10px] text-gray-400 font-mono">Dùng 1 lần gửi kháng</span>
                </div>
                <div className="bg-[#f8fafc] border border-gray-200 rounded-lg p-4 h-96 overflow-y-auto custom-scrollbar font-mono text-[11px] text-gray-700 whitespace-pre-wrap select-all leading-relaxed">
                  {aiResult.content}
                </div>
              </div>
            </div>

            {/* AI Modal buttons */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => {
                  const orig = appealTemplates.find(t => t.id === aiResult.templateId);
                  if (orig) handleAiRewrite(orig);
                }}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-white text-blue-600 rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                <RefreshCw size={13} /> VIẾT BẢN KHÁC
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsAiModalOpen(false);
                    setAiResult(null); // Giải phóng bộ nhớ, hủy bản cũ
                  }}
                  className="px-4 py-2 bg-white hover:bg-gray-105 border border-gray-300 text-gray-600 hover:text-gray-800 rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  ĐÓNG & BỎ
                </button>
                <button
                  onClick={handleCopyAiResult}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-[#00ffff] to-[#00bfff] text-slate-900 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-[0_3px_10px_rgba(0,255,255,0.25)] hover:shadow-[0_4px_15px_rgba(0,255,255,0.4)]"
                >
                  {copiedAi ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
                  {copiedAi ? 'ĐÃ COPY XONG' : 'COPY KẾT QUẢ AI'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer bản quyền chính chủ */}
      <div className="border-t border-gray-250 pt-4 mt-8 flex flex-col sm:flex-row items-center justify-between text-[10px] text-gray-400 font-mono gap-2">
        <span>© 2026 DTA Studio. Phát triển bởi Đức Trường.</span>
        <div className="flex gap-3">
          <a href="https://dta-studio.vercel.app/" target="_blank" rel="noreferrer" className="hover:text-cyan-600 transition-colors">Website</a>
          <span>•</span>
          <a href="tel:0962775506" className="hover:text-cyan-600 transition-colors">Zalo: 0962.775.506</a>
        </div>
      </div>
    </div>
  );
}
