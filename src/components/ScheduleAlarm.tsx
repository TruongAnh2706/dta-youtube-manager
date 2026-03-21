import React, { useState, useEffect, useRef } from 'react';
import { Channel, VideoTask } from '../types';
import { BellRing, X, AlertTriangle, Volume2, Play, Square } from 'lucide-react';
import { format } from 'date-fns';
import alarmSound from '../assets/alarm_dta.mp3';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

interface ScheduleAlarmProps {
  channels: Channel[]; // Đã được lọc quyền từ App.tsx
  tasks: VideoTask[];
  setTasks: React.Dispatch<React.SetStateAction<VideoTask[]>>;
  workflowSteps: any[];
  currentUser: { role: string; name: string; id: string } | null;
}

export function ScheduleAlarm({ channels, tasks, setTasks, workflowSteps, currentUser }: ScheduleAlarmProps) {
  const { showToast } = useToast();
  const [activeAlarms, setActiveAlarms] = useState<
    { id: string; channelId: string; channelName: string; time: string; channelCode: string; dateStr: string }[]
  >([]);
  
  const [snoozedKeys, setSnoozedKeys] = useState<Set<string>>(new Set());
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playCountRef = useRef(0);

  // Auto-Unlock bằng Click ẩn: Khi sếp vừa vào web và bấm bất kỳ đâu, 
  // trình duyệt sẽ tự động ghi nhận là "Đã tương tác" và cho phép mở loa!
  useEffect(() => {
    const handleGlobalClick = () => {
      // Hỏi quyền hiển thị thông báo Desktop gọn gàng trên góc (chỉ hỏi 1 lần nếu chưa cấp)
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    };
    
    // Gắn theo dõi 1 cú click chuột duy nhất từ khi vào web
    document.addEventListener('click', handleGlobalClick, { once: true });
    
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Tính năng TEST LOA bằng tay bất kỳ lúc nào để sếp tự kiểm tra Windows
  const toggleTestAudio = () => {
    if (!audioRef.current) return;
    
    if (isTestingAudio) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsTestingAudio(false);
    } else {
      audioRef.current.volume = 1.0;
      audioRef.current.currentTime = 0;
      audioRef.current.play()
        .then(() => setIsTestingAudio(true))
        .catch(e => console.error("Test Loa bị lỗi:", e));
    }
  };

  // Đếm lặp khi âm thanh phát xong
  const handleEnded = () => {
    setIsTestingAudio(false); // Reset trạng thái test loa nếu phát hết
    if (activeAlarms.length === 0) return; // Nếu hết báo động thì ngắt chu kỳ lặp
    
    playCountRef.current += 1;
    if (playCountRef.current < 5) {
      if (audioRef.current) {
        audioRef.current.play().catch(e => {
          console.log('Auto-play blocked inside loop:', e);
        });
      }
    }
  };

  useEffect(() => {
    const checkAlarms = () => {
      if (channels.length === 0) return;

      const now = new Date();
      const currentDayMap: { [key: number]: string } = {
        0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'
      };
      const currentDayStr = currentDayMap[now.getDay()];
      const dateStr = format(now, 'yyyy-MM-dd');
      const newAlarms: typeof activeAlarms = [];

      channels.forEach(channel => {
        if (!channel.postingSchedules) return;

        channel.postingSchedules.forEach(schedule => {
          if (schedule.days.includes(currentDayStr)) {
            const [hours, minutes] = schedule.time.split(':').map(Number);
            const scheduleDate = new Date(now);
            scheduleDate.setHours(hours, minutes, 0, 0);

            const diffMinutes = (scheduleDate.getTime() - now.getTime()) / (1000 * 60);

            // Báo trước 5 phút (Yêu cầu 1)
            if (diffMinutes <= 5 && diffMinutes >= -5) {
              const alarmKey = `${channel.id}-${dateStr}-${schedule.time}`;
              if (!snoozedKeys.has(alarmKey)) {
                if (!activeAlarms.find(a => a.id === alarmKey) && !newAlarms.find(a => a.id === alarmKey)) {
                  newAlarms.push({
                    id: alarmKey,
                    channelId: channel.id,
                    channelName: channel.name,
                    channelCode: channel.channelCode,
                    time: schedule.time,
                    dateStr: dateStr
                  });
                }
              }
            }
          }
        });
      });

      if (newAlarms.length > 0) {
        setActiveAlarms(prev => [...prev, ...newAlarms]);
        
        // Phát thông báo Native (ngoài Desktop) nếu được phép
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const channelNames = newAlarms.map(a => a.channelName).join(', ');
            new Notification('⏰ ĐẾN GIỜ ĐĂNG VIDEO!', {
              body: `Có ${newAlarms.length} kênh cần xử lý: ${channelNames}`,
            });
          } catch (e) {
            console.log('Native notification failed', e);
          }
        }
        
        // Bật chuông ngầm
        playCountRef.current = 0;
        setSoundBlocked(false); // Reset cờ chặn
        if (audioRef.current) {
          audioRef.current.volume = 1.0;
          audioRef.current.muted = false;
          audioRef.current.currentTime = 0;
          
          audioRef.current.play().catch(e => {
            console.log('Audio autoplay blocked:', e);
            setSoundBlocked(true); // Chrome chưa bắt được click nên vẫn cấm
          });
        }
      }
    };

    const interval = setInterval(checkAlarms, 30000); // Check mỗi 30s
    checkAlarms();

    return () => clearInterval(interval);
  }, [channels, snoozedKeys, activeAlarms]);

  // Dừng âm thanh khi huỷ alert
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const dismissAlarm = async (alarmParam: typeof activeAlarms[0]) => {
    setActiveAlarms(prev => {
      const remaining = prev.filter(a => a.id !== alarmParam.id);
      if (remaining.length === 0) {
        stopAudio();
      }
      return remaining;
    });
    setSnoozedKeys(prev => {
      const newSet = new Set(prev);
      newSet.add(alarmParam.id);
      return newSet;
    });

    // Cập nhật Database: Chuyển Status sang Bước 2 (Đã Nhận Việc/Đang Làm)
    if (!currentUser || !currentUser.id) return;
    
    // KHI NHẤN BÁO THỨC -> LỊCH GIỜ ĐÓ TỰ CHUYỂN THÀNH CÔNG (BƯỚC CUỐI CÙNG)
    const successStatus = workflowSteps.length > 0 ? workflowSteps[workflowSteps.length - 1].id : 'published';

    // Xác định xem đã có Task thật trong DB chưa
    const existingTask = tasks.find(t => t.channelId === alarmParam.channelId && t.dueDate === alarmParam.dateStr && t.publishTime === alarmParam.time);

    if (existingTask) {
       // Cập nhật Task có sẵn
       setTasks(prev => prev.map(t => t.id === existingTask.id ? { ...t, status: successStatus, assigneeIds: [...new Set([...t.assigneeIds, currentUser.id])] } : t));
       await supabase.from('video_tasks').update({ status: successStatus, assignee_ids: [...new Set([...existingTask.assigneeIds, currentUser.id])] }).eq('id', existingTask.id);
       showToast(`Hoàn tất lịch đăng: ${alarmParam.channelName} lúc ${alarmParam.time}`, 'success');
    } else {
       // Tạo Task mới từ Lịch Định Kỳ ảo
       const newTaskId = `task-${Date.now()}`;
       const newTask: VideoTask = {
         id: newTaskId,
         title: `[Lịch Định Kỳ] ${alarmParam.channelName}`,
         channelId: alarmParam.channelId,
         status: successStatus,
         assigneeIds: [currentUser.id],
         dueDate: alarmParam.dateStr,
         publishTime: alarmParam.time,
         videoType: 'long',
         isClaimable: false,
         priority: 'medium',
         productionCost: 0,
         notes: 'Tự động tạo và nhận việc qua báo thức hệ thống'
       };
       setTasks(prev => [...prev, newTask]);
       showToast(`Đã nhận việc đăng kênh: ${alarmParam.channelName}`, 'success');
       
       // Bắn lên DB
       const { error } = await supabase.from('video_tasks').insert([{
         id: newTaskId,
         channel_id: newTask.channelId,
         title: newTask.title,
         status: newTask.status,
         assignee_ids: newTask.assigneeIds,
         due_date: newTask.dueDate,
         publish_time: newTask.publishTime,
         video_type: newTask.videoType,
         priority: newTask.priority,
         notes: newTask.notes
       }]);
       if (error) {
         console.error("Lỗi khi tạo lịch offline vào hệ thống từ Báo thức:", error);
       }
    }
  };

  const dismissAll = async () => {
    const ids = activeAlarms.map(a => a.id);
    setSnoozedKeys(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => newSet.add(id));
      return newSet;
    });
    stopAudio();
    setActiveAlarms([]);

    // Cập nhật Database hàng loạt -> CHUYỂN THÀNH CÔNG BƯỚC CUỐI
    if (!currentUser || !currentUser.id) return;
    const successStatus = workflowSteps.length > 0 ? workflowSteps[workflowSteps.length - 1].id : 'published';

    // Tạo các bản cập nhật và insert DB
    let newTasksToAdd: VideoTask[] = [];
    let updatedTasks: VideoTask[] = [];
    
    for (const alarm of activeAlarms) {
      const existingTask = tasks.find(t => t.channelId === alarm.channelId && t.dueDate === alarm.dateStr && t.publishTime === alarm.time);
      if (existingTask) {
         updatedTasks.push({ ...existingTask, status: successStatus, assigneeIds: [...new Set([...existingTask.assigneeIds, currentUser.id])] });
         await supabase.from('video_tasks').update({ status: successStatus, assignee_ids: [...new Set([...existingTask.assigneeIds, currentUser.id])] }).eq('id', existingTask.id);
      } else {
         const newTaskId = `task-${Date.now()}-${Math.random()}`;
         const newTask: VideoTask = {
           id: newTaskId,
           title: `[Lịch Định Kỳ] ${alarm.channelName}`,
           channelId: alarm.channelId,
           status: successStatus,
           assigneeIds: [currentUser.id],
           dueDate: alarm.dateStr,
           publishTime: alarm.time,
           videoType: 'long',
           isClaimable: false,
           priority: 'medium',
           productionCost: 0,
           notes: 'Tự động tạo và nhận việc qua báo thức hệ thống'
         };
         newTasksToAdd.push(newTask);
         
         await supabase.from('video_tasks').insert([{
           id: newTaskId,
           channel_id: newTask.channelId,
           title: newTask.title,
           status: newTask.status,
           assignee_ids: newTask.assigneeIds,
           due_date: newTask.dueDate,
           publish_time: newTask.publishTime,
           video_type: newTask.videoType,
           priority: newTask.priority,
           notes: newTask.notes
         }]);
      }
    }
    
    setTasks(prev => {
       const mapped = prev.map(t => {
          const matched = updatedTasks.find(ut => ut.id === t.id);
          return matched ? matched : t;
       });
       return [...mapped, ...newTasksToAdd];
    });
    showToast(`Đã nhận việc hàng loạt ${activeAlarms.length} video!`, 'success');
  };

  return (
    <>
      <audio 
        ref={audioRef}
        src={alarmSound}
        onEnded={handleEnded}
        preload="auto"
      />
      
      {/* Nút Test Loa ẩn khi làm việc bình thường để đỡ vướng (chỉ giữ để debug nếu cần) */}
      <button 
        onClick={toggleTestAudio}
        className={`fixed bottom-6 right-6 z-[9000] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-opacity ${
          isTestingAudio 
            ? 'bg-red-600 hover:bg-red-700 opacity-100 animate-pulse' 
            : 'bg-gray-800 hover:bg-gray-900 opacity-30 hover:opacity-100'
        }`}
        title="Check xem loa máy tính có đang tắt/nhỏ quá không?"
      >
        {isTestingAudio ? (
          <>
            <Square size={16} className="text-white fill-white" />
            <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Dừng</span>
          </>
        ) : (
          <>
            <Play size={16} className="text-green-400" />
            <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Test Loa</span>
          </>
        )}
      </button>

      {/* Popup báo động lấp đầy màn hình */}
      {activeAlarms.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
            
            {/* Banner tiêu đề Cảnh báo Lớn */}
            <div className="bg-red-600 rounded-[2rem] shadow-[0_0_50px_rgba(239,68,68,0.5)] p-8 text-center text-white relative overflow-hidden flex flex-col items-center justify-center">
              <div className="absolute inset-0 bg-red-500 opacity-50 animate-ping" style={{ animationDuration: '2s' }}></div>
              <BellRing size={80} className="mb-4 relative z-10 animate-wiggle drop-shadow-xl" />
              <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-widest relative z-10 drop-shadow-lg animate-pulse" style={{ animationDuration: '1s' }}>
                ĐẾN GIỜ ĐĂNG VIDEO!
              </h2>
              <p className="mt-3 text-red-100 font-bold text-lg relative z-10">
                Có {activeAlarms.length} báo thức thuộc thẩm quyền quản lý của bạn.
              </p>
            </div>

            {/* Cứu cánh nếu lỡ chưa Click chuột mà treo tab */}
            {soundBlocked && (
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play()
                      .then(() => setSoundBlocked(false))
                      .catch(e => console.error("Bị block:", e));
                  }
                }}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black uppercase tracking-wider py-4 px-6 rounded-2xl shadow-xl flex items-center justify-center gap-3 border-4 border-yellow-500 animate-pulse"
              >
                <Volume2 size={32} />
                Nhấn vào đây để PHÁT CHUÔNG NGAY
              </button>
            )}

            {/* Danh sách các kênh chờ đăng */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-h-[50vh] flex flex-col border-4 border-white">
              <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-gray-800 flex items-center text-lg">
                  <AlertTriangle size={24} className="text-orange-500 mr-2" />
                  THÔNG TIN KÊNH
                </h3>
                {activeAlarms.length > 1 && (
                  <button
                    onClick={dismissAll}
                    className="text-sm font-bold text-gray-500 hover:text-white bg-gray-100 hover:bg-red-500 px-4 py-2 rounded-xl transition-colors"
                  >
                    Xác nhận tất cả
                  </button>
                )}
              </div>
              
              <div className="p-4 overflow-y-auto space-y-3">
                {activeAlarms.map((alarm) => (
                  <div
                    key={alarm.id}
                    className="flex flex-col sm:flex-row gap-4 sm:gap-2 items-start sm:items-center justify-between p-5 rounded-2xl border-l-8 border-l-red-500 bg-red-50/50 hover:bg-red-100/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-gray-800 text-white text-xs uppercase font-black px-2.5 py-1 rounded">
                          [{alarm.channelCode}]
                        </span>
                        <span className="font-black text-red-600 tabular-nums bg-white px-2 py-0.5 rounded shadow-sm border border-red-100">
                          GIỜ ĐĂNG: {alarm.time}
                        </span>
                      </div>
                      <h4 className="text-xl font-bold text-gray-900 leading-tight">
                        {alarm.channelName}
                      </h4>
                    </div>
                    
                    <button
                      onClick={() => dismissAlarm(alarm)}
                      className="w-full sm:w-auto shrink-0 bg-red-500 hover:bg-red-600 text-white font-black py-4 px-8 rounded-xl transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30 text-lg border-b-4 border-red-700"
                    >
                      ĐÃ XỬ LÝ
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </div>
      )}
    </>
  );
}
