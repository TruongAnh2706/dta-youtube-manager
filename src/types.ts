export type PostingSchedule = {
  time: string; // HH:mm
  days: string[]; // ['Mon', 'Tue', ...]
};

export type Topic = {
  id: string;
  name: string;
  description: string;
  color: string;
  tags: string[];
  hashtags: string[];
  country: string;
  targetAudience?: string;
  contentStrategy?: string;
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  monetizationPotential?: 'low' | 'medium' | 'high';
  competitionLevel?: 'low' | 'medium' | 'high';
  niche?: string; // Tên thị trường ngách lớn
  assignees?: string[]; // Danh sách ID các nhân sự được giao quản lý chủ đề này
  defaultSchedules?: PostingSchedule[]; // Lịch đăng mẫu
};

export const DEFAULT_NICHES = [
  'Giải Trí & Hài hước',
  'Tài Chính & Kinh doanh',
  'Kiến Thức & Giáo dục',
  'Gaming & Esports',
  'Đời Sống & Vlog',
  'Sức Khỏe & Thể thao',
  'Công Nghệ & Gadgets',
  'Tin Tức & Sự Kiện',
  'Âm Nhạc & Nghệ thuật',
  'Trẻ Em & Gia đình',
  'Khác',
];

export type Channel = {
  id: string;
  channelCode: string;
  name: string;
  url: string;
  avatarUrl?: string;
  subscribers: number;
  totalViews?: number;
  topicIds: string[];
  status: 'active' | 'inactive' | 'suspended' | 'dead';
  healthStatus?: 'healthy' | 'warning' | 'danger';
  healthNotes?: string;
  lastHealthCheck?: string;
  notes: string;
  // Sensitive info
  email?: string;
  password?: string;
  recoveryEmail?: string;
  twoFactorCode?: string;
  proxyId?: string;
  postingSchedules?: PostingSchedule[];
};

export type YoutubeVideo = {
  id: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount?: number;
  duration?: string;
};

export type SourceChannel = {
  id: string;
  name: string;
  url: string;
  avatarUrl?: string;
  topicIds: string[];
  rating: number; // 1 to 5
  uploadFrequency: string;
  averageViews: number;
  subscribers?: number;
  totalViews?: number;
  videoCount?: number;
  publishedAt?: string;
  description?: string;
  latestVideos?: YoutubeVideo[];
  topVideos?: YoutubeVideo[];
  isViral?: boolean;
  viralVideoTitle?: string;
  viralVideoViews?: number;
  notes: string;
  allowedStaffIds?: string[]; // Mảng ID của những nhân viên được phép xem, admin mặc định full quyền
  status?: 'active' | 'dead';
};

export type StaffRole = 'admin' | 'manager' | 'leader' | 'member';

export type PermissionKey =
  | 'dashboard_view'
  | 'topics_view' | 'topics_edit'
  | 'sources_view' | 'sources_edit' | 'sources_analyze'
  | 'channels_view' | 'channels_edit' | 'channels_view_sensitive' | 'channels_manage_proxy'
  | 'staff_view' | 'staff_edit' | 'staff_view_salary'
  | 'calendar_view' | 'calendar_edit' | 'calendar_view_all' | 'calendar_delete'
  | 'finance_view' | 'finance_edit' | 'finance_view_accounts'
  | 'copyright_view' | 'copyright_edit'
  | 'assets_view' | 'assets_edit'
  | 'tasks_view' | 'tasks_edit' | 'tasks_claim'
  | 'emails_view' | 'emails_edit'
  | 'settings_view' | 'settings_edit_keys' | 'settings_edit_permissions';

export type RolePermissions = Record<StaffRole, PermissionKey[]>;
export type StaffSkill = 'scriptwriter' | 'voiceover' | 'editor' | 'designer';

export type Staff = {
  id: string;
  name: string;
  role: StaffRole;
  skills: StaffSkill[];
  email: string;
  phone: string;
  username?: string;
  password?: string;
  assignedChannelIds: string[];
  status: 'online' | 'offline' | 'inactive';
  baseSalary: number;
  managedEmailCount: number;
  kpiTargets?: {
    daily: number;
    weekly: number;
    monthly: number;
  };
};

export type TaskStatus = string;export type VideoTask = {
  id: string;
  title: string;
  channelId: string;
  status: TaskStatus;
  assigneeIds: string[];
  dueDate: string;
  publishTime?: string; // HH:mm
  videoType?: 'shorts' | 'long';
  scriptLink?: string;
  thumbnailLink?: string;
  productionCost?: number;
  notes: string;
  scriptOutline?: string;
  priority?: 'low' | 'medium' | 'high';
  workflowStep?: number;
  bestPublishTime?: string;
  isClaimable?: boolean;
  linkedAssetIds?: string[];
  comments?: {
    id: string;
    userId: string;
    userName: string;
    text: string;
    timestamp: string;
  }[];
  timeTracking?: {
    totalSeconds: number;
    isRunning: boolean;
    lastStartTime?: string;
  };
};

export type DailyReport = {
  id: string;
  staffId: string;
  date: string;
  renderedCount: number;
  notes: string;
  timestamp: string;
  completedTasks?: { id: string; title: string }[];
  pendingTasks?: { id: string; title: string }[];
  issues?: string;
  expenses?: number;
  planTomorrow?: string;
};

export type FinancialRecord = {
  id: string;
  channelId: string;
  month: string; // YYYY-MM format
  revenue: number;
  rpm: number;
  cpm: number;
  expenses: number;
  netProfit: number;
  roi?: number;
  notes: string;
};

export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionCategory = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
};

export type FinancialAccount = {
  id: string;
  name: string;
  type: 'bank' | 'cash' | 'e-wallet' | 'credit';
  balance: number;
  currency: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  branch?: string;
};

export type Transaction = {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  toAccountId?: string; // For transfers
  description: string;
  referenceId?: string; // Link to channel, task, or staff if needed
  referenceType?: 'channel' | 'staff' | 'task' | 'other';
  status: 'completed' | 'pending' | 'cancelled';
};

export type StrikeType = 'copyright' | 'community';
export type StrikeStatus = 'active' | 'appealed' | 'expired' | 'resolved';

export type Strike = {
  id: string;
  channelId: string;
  type: StrikeType;
  dateReceived: string;
  expirationDate: string;
  status: StrikeStatus;
  details: string;
  appealHistory?: string[];
  errorType?: string;
};

export type AssetType = 'drive' | 'stock_video' | 'audio' | 'template' | 'font' | 'footage' | 'license';

export type Asset = {
  id: string;
  name: string;
  type: AssetType;
  url: string;
  notes: string;
  expirationDate?: string;
};

export type Proxy = {
  id: string;
  ip: string;
  port: string;
  username?: string;
  password?: string;
  status: 'active' | 'inactive' | 'dead';
  lastCheck?: string;
  latency?: number;
  notes: string;
};

export type License = {
  id: string;
  softwareName: string;
  accountEmail: string;
  password?: string;
  licenseKey?: string;
  expirationDate: string;
  cost: number;
  status: 'active' | 'expired';
  devices?: string[];
  reminderSent?: boolean;
};

export type ManagedEmail = {
  id: string;
  channelCode?: string;
  email: string;
  password?: string;
  recoveryEmail?: string;
  twoFactorAuth?: string;
  verificationPhone?: string;
  assignedTo?: string | null; // staff ID
  status: string; // Dynamic status from SystemSettings
  notes?: string;
  createdAt?: string;
  targetTopicIds?: string[]; // (Optional) Gán sẵn định hướng kênh sẽ làm chủ đề gì
};

export interface Competitor {
  id: string;
  name: string;
  url: string;
  subscriberCount: string;
  videoCount: string;
  lastVideoTitle?: string;
  lastVideoDate?: string;
  notes?: string;
  topicIds: string[];
  allowedStaffIds?: string[];
}

export type ApiKey = {
  id: string;
  key: string;
  provider: 'youtube' | 'gemini' | 'other';
  status: 'active' | 'quota_exceeded' | 'invalid';
  note?: string;
};

export type AuditLog = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
  ip?: string;
};

export type TrainingDoc = {
  id: string;
  title: string;
  category: 'sop' | 'tutorial' | 'policy' | 'resource';
  url: string;
  lastUpdated: string;
  author: string;
};

export type CustomStatus = {
  id: string;
  label: string;
  color: string; // Tailwind class string, e.g., 'bg-red-100 text-red-700'
};

export type SystemSettings = {
  youtubeApiKeys: ApiKey[];
  geminiApiKeys: ApiKey[];
  activeYoutubeKeyIndex: number;
  auditLogs: AuditLog[];
  trainingDocs: TrainingDoc[];
  emailStatuses?: CustomStatus[];
  taskStatuses?: CustomStatus[];
};



