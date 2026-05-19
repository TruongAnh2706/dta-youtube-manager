import React, { useState, useEffect } from 'react';
import { Bug, X, Save, Trash2, Copy, Check } from 'lucide-react';

interface BugNote {
    id: string;
    tab: string;
    content: string;
    date: string;
}

interface BugReporterProps {
    activeTab: string;
}

export function BugReporter({ activeTab }: BugReporterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notes, setNotes] = useState<BugNote[]>([]);
    const [currentNote, setCurrentNote] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('dta_bug_notes');
        if (saved) {
            try {
                setNotes(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse notes');
            }
        }
    }, []);

    const saveNote = () => {
        if (!currentNote.trim()) return;
        
        const newNote: BugNote = {
            id: crypto.randomUUID(),
            tab: activeTab,
            content: currentNote,
            date: new Date().toISOString()
        };
        
        const updated = [newNote, ...notes];
        setNotes(updated);
        localStorage.setItem('dta_bug_notes', JSON.stringify(updated));
        setCurrentNote('');
    };

    const deleteNote = (id: string) => {
        const updated = notes.filter(n => n.id !== id);
        setNotes(updated);
        localStorage.setItem('dta_bug_notes', JSON.stringify(updated));
    };

    const copyAllNotes = () => {
        const text = notes.map(n => `[Tab: ${n.tab}] ${new Date(n.date).toLocaleString('vi-VN')}\n- ${n.content}`).join('\n\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            {/* Nút Floating */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-all z-50 group flex items-center justify-center"
                title="Ghi chú Lỗi / Tính năng"
            >
                <Bug size={24} />
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-2 font-medium">
                    Ghi chú Lỗi
                </span>
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                            <div className="flex items-center gap-2 text-red-600 font-bold">
                                <Bug size={20} />
                                <h2>Ghi chú Fix Bug & Cập nhật</h2>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-4 flex flex-col gap-3 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="font-semibold">Vị trí hiện tại:</span>
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-mono text-xs uppercase">{activeTab}</span>
                            </div>
                            <textarea
                                value={currentNote}
                                onChange={(e) => setCurrentNote(e.target.value)}
                                placeholder="Mô tả lỗi hoặc tính năng cần thêm tại tab này..."
                                className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none text-sm"
                            />
                            <button
                                onClick={saveNote}
                                disabled={!currentNote.trim()}
                                className="flex items-center justify-center gap-2 w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50 transition-colors text-sm font-medium"
                            >
                                <Save size={16} /> Lưu ghi chú
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 bg-gray-50 rounded-b-xl">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-gray-700">Danh sách Ghi chú ({notes.length})</h3>
                                {notes.length > 0 && (
                                    <button
                                        onClick={copyAllNotes}
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-50 px-2 py-1 rounded"
                                    >
                                        {copied ? <Check size={14} /> : <Copy size={14} />} 
                                        {copied ? 'Đã copy' : 'Copy gửi AI'}
                                    </button>
                                )}
                            </div>
                            
                            {notes.length === 0 ? (
                                <p className="text-center text-sm text-gray-400 py-4">Chưa có ghi chú nào.</p>
                            ) : (
                                <div className="space-y-3">
                                    {notes.map(note => (
                                        <div key={note.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm relative group">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                    {note.tab}
                                                </span>
                                                <button
                                                    onClick={() => deleteNote(note.id)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
