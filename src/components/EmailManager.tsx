import React, { useState, useRef } from 'react';
import { 
  Search, Plus, Upload, Download, Trash2, Edit2, ShieldAlert,
  Save, X, FileDown, CheckCircle2, Clock, AlertTriangle, PlayCircle, Eye, EyeOff, Copy
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ManagedEmail, Staff, Topic, VideoTask } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';

interface EmailManagerProps {
  emails: ManagedEmail[];
  setEmails: React.Dispatch<React.SetStateAction<ManagedEmail[]>>;
  staffList: Staff[];
  topics: Topic[];
  currentUser: { id: string, role: string, name: string } | null;
  tasks: VideoTask[];
  setTasks: React.Dispatch<React.SetStateAction<VideoTask[]>>;
  systemSettings?: import('../types').SystemSettings;
}

export function EmailManager({ emails, setEmails, staffList, topics, currentUser, tasks, setTasks, systemSettings }: EmailManagerProps) {
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<ManagedEmail | null>(null);
  
  const [formData, setFormData] = useState<Omit<ManagedEmail, 'id' | 'createdAt'>>({
    email: '', password: '', recoveryEmail: '', twoFactorAuth: '', 
    verificationPhone: '', assignedTo: '', status: 'new', notes: '', targetTopicIds: []
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const handleOpenModal = (email?: ManagedEmail) => {
    if (email) {
      setEditingEmail(email);
      setFormData({
        email: email.email,
        password: email.password || '',
        recoveryEmail: email.recoveryEmail || '',
        twoFactorAuth: email.twoFactorAuth || '',
        verificationPhone: email.verificationPhone || '',
        assignedTo: email.assignedTo || '',
        status: email.status || 'new',
        notes: email.notes || '',
        targetTopicIds: email.targetTopicIds || [],
        channelCode: email.channelCode || ''
      });
    } else {
      setEditingEmail(null);
      setFormData({
        email: '', password: '', recoveryEmail: '', twoFactorAuth: '', 
        verificationPhone: '', assignedTo: '', status: 'new', notes: '', targetTopicIds: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCopy = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${type}`, 'info');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;

    if (editingEmail) {
      const isNewlyAssigned = formData.assignedTo && formData.assignedTo !== editingEmail.assignedTo;
      
      setEmails(prev => prev.map(em => em.id === editingEmail.id ? { ...em, ...formData, assignedTo: formData.assignedTo || null } as ManagedEmail : em));
      
      if (isNewlyAssigned) {
        const newTask: VideoTask = {
          id: `task_${Date.now()}`,
          title: `[Khởi tạo kênh] Email: ${formData.email}`,
          channelId: editingEmail.id,
          status: 'pending',
          assigneeIds: [formData.assignedTo],
          dueDate: new Date().toISOString().split('T')[0],
          videoType: 'long',
          priority: 'medium',
          notes: `Tiến hành ngâm và lập kênh cho email: ${formData.email} \nPass: ${formData.password} \nKhôi phục: ${formData.recoveryEmail}\nXác minh SĐT: ${formData.verificationPhone}\nKênh dự kiến: ${formData.channelCode}`,
          isClaimable: false
        };
        setTasks(prev => [...prev, newTask]);
      }
      
      showToast('Cập nhật email thành công', 'success');
    } else {
      const isExist = emails.some(em => em.email.toLowerCase() === formData.email.toLowerCase());
      if (isExist) {
        showToast('Email này đã tồn tại trong hệ thống', 'error');
        return;
      }
      
      const newEmail: ManagedEmail = {
        ...formData,
        assignedTo: formData.assignedTo || null,
        id: `email_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      setEmails(prev => [newEmail, ...prev]);

      if (formData.assignedTo) {
        const newTask: VideoTask = {
          id: `task_${Date.now()}`,
          title: `[Khởi tạo kênh] Email: ${formData.email}`,
          channelId: newEmail.id,
          status: 'pending',
          assigneeIds: [formData.assignedTo],
          dueDate: new Date().toISOString().split('T')[0],
          videoType: 'long',
          priority: 'medium',
          notes: `Tiến hành ngâm và lập kênh cho email: ${formData.email} \nPass: ${formData.password} \nKhôi phục: ${formData.recoveryEmail}\nXác minh SĐT: ${formData.verificationPhone}\nKênh dự kiến: ${formData.channelCode}`,
          isClaimable: false
        };
        setTasks(prev => [...prev, newTask]);
      }

      showToast('Thêm email thành công', 'success');
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa email này?')) {
      setEmails(prev => prev.filter(em => em.id !== id));
      const { error } = await supabase.from('managed_emails').delete().eq('id', id);
      if (error) showToast(`Lỗi xóa: ${error.message}`, 'error');
      else showToast('Xóa email thành công', 'info');
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Bạn có chắc muốn xóa ${selectedIds.length} email đã chọn?`)) {
      setEmails(prev => prev.filter(em => !selectedIds.includes(em.id)));
      const { error } = await supabase.from('managed_emails').delete().in('id', selectedIds);
      if (error) showToast(`Lỗi xóa: ${error.message}`, 'error');
      else showToast(`Đã xóa ${selectedIds.length} email`, 'info');
      setSelectedIds([]);
    }
  };

  const handleBulkStatusChange = (newStatus: string) => {
    setEmails(prev => prev.map(em => selectedIds.includes(em.id) ? { ...em, status: newStatus } : em));
    showToast(`Đã cập nhật trạng thái ${selectedIds.length} email`, 'success');
    setSelectedIds([]);
  };

  const handleBulkAssign = (staffId: string) => {
    const assignedEmails = emails.filter(em => selectedIds.includes(em.id));
    const finalStaffId = staffId === '' ? null : staffId;
    
    // Tạo tasks cho nhân sự (nếu có nhân sự được giao)
    const newTasks: VideoTask[] = finalStaffId ? assignedEmails.map((em, index) => ({
      id: `task_${Date.now()}_${index}`,
      title: `[Khởi tạo kênh] Email: ${em.email}`,
      channelId: em.id, // Dùng email ID tạm làm channel ID vì nó chưa thành kênh chính thức
      status: 'pending',
      assigneeIds: [finalStaffId],
      dueDate: new Date().toISOString().split('T')[0],
      videoType: 'long',
      priority: 'medium',
      notes: `Tiến hành ngâm và lập kênh cho email: ${em.email} \\nPass: ${em.password} \\nKhôi phục: ${em.recoveryEmail}\\nXác minh SĐT: ${em.verificationPhone}\\nKênh dự kiến: ${em.channelCode}`,
      isClaimable: false
    })) : [];

    setEmails(prev => prev.map(em => selectedIds.includes(em.id) ? { ...em, assignedTo: finalStaffId } : em));
    if (newTasks.length > 0) {
      setTasks(prev => [...prev, ...newTasks]);
    }
    
    showToast(`Đã giao ${selectedIds.length} email và tạo task cho nhân sự`, 'success');
    setSelectedIds([]);
  };

  const handleBulkExport = () => {
    const selectedData = emails.filter(em => selectedIds.includes(em.id));
    if (selectedData.length === 0) return;

    const exportData = selectedData.map(em => {
      const statusObj = systemSettings?.emailStatuses?.find(s => s.id === em.status);
      const statusText = statusObj ? statusObj.label : em.status;

      const topicNames = em.targetTopicIds?.map(tid => topics.find(t => t.id === tid)?.name).filter(Boolean).join(', ') || '';

      return {
        'Mã Kênh': em.channelCode || '',
        'Email': em.email || '',
        'Mật khẩu': em.password || '',
        'Email Khôi Phục': em.recoveryEmail || '',
        '2FA': em.twoFactorAuth || '',
        'SĐT Xác minh': em.verificationPhone || '',
        'Trạng thái': statusText,
        'Ghi chú': em.notes || '',
        'Chủ đề dự kiến': topicNames
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Emails');
    const fileName = `DanhSachEmail_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showToast(`Đã xuất ${selectedData.length} email ra file Excel`, 'success');
    setSelectedIds([]);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'Mã Kênh': 'CD1', 'Email': 'example@gmail.com', 'Mật khẩu': 'pass123', 'Email Khôi Phục': 'recovery@gmail.com',
      '2FA': 'ABCD 1234 EFGH', 'SĐT Xác minh': '0987654321', 'Trạng thái': 'Đang ngâm', 'Ghi chú': 'Email VN', 'Chủ đề dự kiến': 'Giải Trí, Vlog'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Email_Import_Template.xlsx');
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBulkImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let addedCount = 0;
        let skipCount = 0;
        const newEmails: ManagedEmail[] = [];

        data.forEach((row) => {
          const emailStr = (row['Email'] || '').trim();
          if (!emailStr) return;

          const isExist = emails.some(e => e.email.toLowerCase() === emailStr.toLowerCase()) || 
                          newEmails.some(e => e.email.toLowerCase() === emailStr.toLowerCase());
          
          if (isExist) {
            skipCount++;
            return;
          }

          let topicIds: string[] = [];
          if (row['Chủ đề dự kiến']) {
            const rawTopicStr = String(row['Chủ đề dự kiến']);
            const topicNames = rawTopicStr.split(',').map(t => t.trim()).filter(Boolean);
            topicIds = topics.filter(t => topicNames.includes(t.name)).map(t => t.id);
          }

          let statusVal: string = 'new';
          const rawStatus = String(row['Trạng thái'] || '').toLowerCase();
          const matchedStatus = systemSettings?.emailStatuses?.find(s => rawStatus.includes(s.label.toLowerCase()) || rawStatus === s.id.toLowerCase());
          if (matchedStatus) statusVal = matchedStatus.id;

          newEmails.push({
            id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            channelCode: String(row['Mã Kênh'] || '').trim(),
            email: emailStr,
            password: String(row['Mật khẩu'] || ''),
            recoveryEmail: String(row['Email Khôi Phục'] || ''),
            twoFactorAuth: String(row['2FA'] || ''),
            verificationPhone: String(row['SĐT Xác minh'] || ''),
            notes: String(row['Ghi chú'] || ''),
            status: statusVal,
            targetTopicIds: topicIds,
            createdAt: new Date().toISOString()
          });
          addedCount++;
        });

        if (newEmails.length > 0) {
          setEmails(prev => [...newEmails, ...prev]);
        }
        showToast(`Nhập xong! Đã thêm ${addedCount} email. Bỏ qua ${skipCount} trùng lặp.`, 'success');
      } catch (error) {
        console.error(error);
        showToast('Lỗi khi đọc file Excel', 'error');
      } finally {
        setIsBulkImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredEmails = emails.filter(em => {
    const matchesSearch = em.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (em.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || em.status === filterStatus;
    
    // Privacy filter
    let isAllowed = hasPermission('emails_edit') || currentUser?.role === 'admin' || currentUser?.role === 'manager'; // Quản lý thấy hết
    if (!isAllowed) {
      if (currentUser && em.assignedTo === currentUser.id) isAllowed = true;
    }

    const matchesStaff = filterStaff === 'all' || em.assignedTo === filterStaff;

    return matchesSearch && matchesStatus && matchesStaff && isAllowed;
  });

  const getStatusBadge = (status: string) => {
    const s = systemSettings?.emailStatuses?.find(st => st.id === status);
    if (!s) return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200">{status}</span>;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium border border-gray-200/50 flex items-center w-fit ${s.color}`}><Clock size={12} className="mr-1"/> {s.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Quản lý Email (Tài khoản thô)
            <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {filteredEmails.length} / {emails.length} email
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Danh sách email cấp phát cho nhân sự để lập kênh</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasPermission('emails_edit') && (
            <>
              <button onClick={downloadTemplate} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors">
                <FileDown size={16} className="mr-2" /> File mẫu
              </button>
              <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors cursor-pointer">
                <Upload size={16} className="mr-2" /> Nhập Excel
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleBulkImport} disabled={isBulkImporting} />
              </label>
              <button onClick={() => handleOpenModal()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors">
                <Plus size={16} className="mr-2" /> Thêm Email
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Tìm email hoặc ghi chú..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]">
          <option value="all">Tất cả trạng thái</option>
          {(systemSettings?.emailStatuses || []).map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
          <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]">
            <option value="all">Tất cả nhân sự</option>
            <option value="">Chưa giao ai</option>
            {staffList.filter(s => s.role !== 'admin').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {selectedIds.length > 0 && hasPermission('emails_edit') && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between shadow-sm">
          <span className="text-sm font-medium text-blue-800">
            Đã chọn <strong>{selectedIds.length}</strong> email
          </span>
          <div className="flex space-x-2 flex-wrap gap-y-2">
            <select className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white" onChange={(e) => { 
                if (e.target.value !== 'default') handleBulkAssign(e.target.value); 
                e.target.value = 'default'; 
              }} defaultValue="default">
              <option value="default" disabled>-- Giao cho nhân sự --</option>
              <option value="">-- Hủy giao việc --</option>
              {staffList.filter(s => s.role !== 'admin').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white" onChange={(e) => { if (e.target.value) handleBulkStatusChange(e.target.value); e.target.value = ''; }}>
              <option value="">-- Đổi trạng thái --</option>
              {(systemSettings?.emailStatuses || []).map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <button onClick={handleBulkExport} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors flex items-center">
              <Download size={14} className="mr-1.5" /> Xuất Excel
            </button>
            <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors">
              Xóa {selectedIds.length} email
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                {hasPermission('emails_edit') && (
                  <th className="p-3 font-medium w-10">
                    <input 
                      type="checkbox" 
                      checked={filteredEmails.length > 0 && selectedIds.length === filteredEmails.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filteredEmails.map(c => c.id));
                        else setSelectedIds([]);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="p-3 font-medium w-24">Mã Kênh</th>
                <th className="p-3 font-medium min-w-[200px]">Email</th>
                <th className="p-3 font-medium min-w-[250px]">Bảo mật</th>
                <th className="p-3 font-medium w-36">Nhân sự</th>
                <th className="p-3 font-medium w-36">Trạng thái</th>
                <th className="p-3 font-medium min-w-[150px]">Ghi chú</th>
                <th className="p-3 font-medium w-20 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredEmails.map(email => {
                const staff = staffList.find(s => s.id === email.assignedTo);
                const isPasswordVisible = showPasswords[email.id];

                return (
                  <tr key={email.id} className="hover:bg-gray-50 transition-colors">
                    {hasPermission('emails_edit') && (
                      <td className="p-3">
                        <input 
                          type="checkbox"
                          checked={selectedIds.includes(email.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(prev => [...prev, email.id]);
                            else setSelectedIds(prev => prev.filter(id => id !== email.id));
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="p-3">
                      <div className="font-semibold text-gray-800 text-xs bg-gray-100 px-2 py-1 rounded w-fit">{email.channelCode || '-'}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-gray-900 break-all">{email.email}</div>
                      {email.targetTopicIds && email.targetTopicIds.length > 0 && (
                        <div className="text-[11px] text-gray-500 mt-1 line-clamp-1">
                          ĐH: {email.targetTopicIds.map(tid => topics.find(t => t.id === tid)?.name).filter(Boolean).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1.5 min-w-[180px]">
                        <div className="flex items-center text-xs font-mono bg-gray-50 px-2 py-1 rounded-md w-fit group border border-gray-100">
                          <span className="mr-2 text-gray-700 min-w-[36px]">Pass:</span>
                          <span className="font-semibold text-blue-700 select-all">{isPasswordVisible ? (email.password || '---') : '••••••••'}</span>
                          <div className="ml-2 flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setShowPasswords(prev => ({...prev, [email.id]: !prev[email.id]}))}
                              className="text-gray-400 hover:text-blue-600 focus:outline-none"
                              title={isPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                            >
                              {isPasswordVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            {email.password && (
                              <button 
                                onClick={() => handleCopy(email.password, 'mật khẩu')}
                                className="text-gray-400 hover:text-blue-600 focus:outline-none"
                                title="Sao chép mật khẩu"
                              >
                                <Copy size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {(email.recoveryEmail || !!email.twoFactorAuth) && (
                          <div className="flex flex-col gap-1 text-[11px] text-gray-500">
                            {email.recoveryEmail && (
                              <div className="flex items-center">
                                <span className="min-w-[36px]">KP:</span>
                                <span className="select-all text-gray-600">{email.recoveryEmail}</span>
                                <button onClick={() => handleCopy(email.recoveryEmail, 'email khôi phục')} className="ml-1.5 text-gray-400 hover:text-blue-600">
                                   <Copy size={11} />
                                </button>
                              </div>
                            )}
                            {email.twoFactorAuth && (
                              <div className="flex items-center group/2fa w-fit">
                                <span className="min-w-[36px]">2FA:</span>
                                <span className="font-mono text-gray-700 select-all">{isPasswordVisible ? email.twoFactorAuth : '••••••••'}</span>
                                {isPasswordVisible && (
                                   <button 
                                     onClick={() => handleCopy(email.twoFactorAuth, 'mã 2FA')}
                                     className="ml-2 md:opacity-0 md:group-hover/2fa:opacity-100 transition-opacity text-gray-400 hover:text-blue-600"
                                     title="Sao chép mã 2FA"
                                   >
                                     <Copy size={11} />
                                   </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {staff ? (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded border border-gray-200 truncate max-w-[120px]" title={staff.name}>
                          {staff.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Chưa giao</span>
                      )}
                    </td>
                    <td className="p-3">
                      {getStatusBadge(email.status)}
                    </td>
                    <td className="p-3">
                      <div className="text-[12px] text-gray-600 line-clamp-2 max-w-[200px]" title={email.notes}>
                        {email.notes || '-'}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button onClick={() => handleOpenModal(email)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Sửa">
                          <Edit2 size={16} />
                        </button>
                        {hasPermission('emails_edit') && (
                          <button onClick={() => handleDelete(email.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Xóa">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredEmails.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Chưa có email nào trong danh sách.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-xl font-bold text-gray-900">
                {editingEmail ? 'Sửa thông tin Email' : 'Thêm Email mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="emailForm" onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã Kênh</label>
                    <input type="text" value={formData.channelCode || ''} onChange={e => setFormData({ ...formData, channelCode: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="VD: CD1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                    <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                    <input type="text" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email khôi phục</label>
                    <input type="email" value={formData.recoveryEmail} onChange={e => setFormData({ ...formData, recoveryEmail: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã 2FA (Bí mật)</label>
                    <input type="text" value={formData.twoFactorAuth} onChange={e => setFormData({ ...formData, twoFactorAuth: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái setup kênh</label>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {(systemSettings?.emailStatuses || []).map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  {hasPermission('emails_edit') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nhân sự phụ trách</label>
                      <select value={formData.assignedTo || ''} onChange={e => setFormData({ ...formData, assignedTo: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Trống --</option>
                        {staffList.filter(s => s.role !== 'admin').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (Tình trạng lỗi, Proxy...)</label>
                    <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3}></textarea>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors">
                Hủy
              </button>
              <button type="submit" form="emailForm" className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors flex items-center">
                <Save size={18} className="mr-2" /> Lưu Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
