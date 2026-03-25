const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const googleTrends = require('google-trends-api');

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;
const BCRYPT_ROUNDS = 10;

// Helper: Chuyển đổi camelCase → snake_case cho PostgreSQL
function toSnakeCase(obj) {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) {
        return obj.map(v => toSnakeCase(v));
    } else if (typeof obj === 'object') {
        const result = {};
        for (const key of Object.keys(obj)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            result[snakeKey] = toSnakeCase(obj[key]);
        }
        return result;
    }
    return obj;
}

// Helper: Chuyển đổi snake_case → camelCase cho frontend
function toCamelCase(obj) {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) {
        return obj.map(v => toCamelCase(v));
    } else if (typeof obj === 'object') {
        const result = {};
        for (const key of Object.keys(obj)) {
            const camelKey = key.replace(/_([a-z])/g, (m, letter) => letter.toUpperCase());
            result[camelKey] = toCamelCase(obj[key]);
        }
        return result;
    }
    return obj;
}

// Supabase client với service_role key (full access, KHÔNG dùng anon key)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

// ========================================
// P0.2: AUTH ENDPOINTS (bcrypt)
// ========================================

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Response: { id, role, name } hoặc 401
 */
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu.' });
    }

    try {
        const { data: staff, error } = await supabase
            .from('staff_list')
            .select('id, username, password, role, name, status')
            .ilike('username', username.trim().toLowerCase())
            .single();

        console.log(`[AUTH] Query result for '${username}':`, { staff: staff ? `found (id: ${staff.id})` : 'null', error: error?.message || 'none' });

        if (error || !staff) {
            console.log(`[AUTH] Login failed: user not found or DB error. Error: ${error?.message || 'no staff found'}`);
            return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác.' });
        }

        if (staff.status === 'inactive') {
            return res.status(403).json({ error: 'Tài khoản này đã bị khóa.' });
        }

        // So sánh password: hỗ trợ cả bcrypt hash và plaintext (migration period)
        let isMatch = false;
        if (staff.password.startsWith('$2a$') || staff.password.startsWith('$2b$')) {
            // Password đã được hash
            isMatch = await bcrypt.compare(password, staff.password);
        } else {
            // Password plaintext cũ → so khớp rồi auto-migrate sang hash
            isMatch = (staff.password === password);
            if (isMatch) {
                // Tự động hash password cũ khi đăng nhập thành công
                const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
                await supabase
                    .from('staff_list')
                    .update({ password: hashedPassword })
                    .eq('id', staff.id);
                console.log(`[AUTH] Auto-migrated password to bcrypt for user: ${staff.username}`);
            }
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác.' });
        }

        res.json({
            id: staff.id,
            role: staff.role,
            name: staff.name
        });

    } catch (err) {
        console.error('[AUTH] Login error:', err);
        res.status(500).json({ error: 'Lỗi hệ thống khi xác thực.' });
    }
});

/**
 * POST /api/auth/change-password
 * Body: { staffId, oldPassword, newPassword }
 */
app.post('/api/auth/change-password', async (req, res) => {
    const { staffId, oldPassword, newPassword } = req.body;

    if (!staffId || !oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Thiếu thông tin.' });
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 4 ký tự.' });
    }

    try {
        const { data: staff, error } = await supabase
            .from('staff_list')
            .select('id, password')
            .eq('id', staffId)
            .single();

        if (error || !staff) {
            return res.status(404).json({ error: 'Không tìm thấy nhân sự.' });
        }

        // Verify old password
        let isMatch = false;
        if (staff.password.startsWith('$2a$') || staff.password.startsWith('$2b$')) {
            isMatch = await bcrypt.compare(oldPassword, staff.password);
        } else {
            isMatch = (staff.password === oldPassword);
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'Mật khẩu cũ không chính xác.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        const { error: updateError } = await supabase
            .from('staff_list')
            .update({ password: hashedPassword })
            .eq('id', staffId);

        if (updateError) {
            return res.status(500).json({ error: 'Lỗi cập nhật mật khẩu.' });
        }

        res.json({ success: true, message: 'Đã đổi mật khẩu thành công.' });

    } catch (err) {
        console.error('[AUTH] Change password error:', err);
        res.status(500).json({ error: 'Lỗi hệ thống.' });
    }
});

/**
 * POST /api/staff/create
 * Body: { name, role, username, password, ... }
 * Gửi lên Supabase Auth Admin để tạo user, sau đó insert vào staff_list
 */
app.post('/api/staff/create', async (req, res) => {
    const { password, email, ...staffData } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Thiếu mật khẩu.' });
    }
    
    if (!email) {
        return res.status(400).json({ error: 'Thiếu Email.' });
    }

    try {
        // 1. Tạo Auth User bằng Admin SDK
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { name: staffData.name } 
            // staff_id sẽ được update sau khi staff_list insert thành công hoặc ngược lại
        });

        if (authError) {
            console.error('[AUTH] Create User Error:', authError.message);
            return res.status(400).json({ error: `Lỗi Auth: ${authError.message}` });
        }

        // 2. Insert vào staff_list - PHẢI chuyển sang snake_case cho PostgreSQL
        const dbPayload = toSnakeCase(staffData);
        dbPayload.password = 'Managed by Supabase Auth';
        dbPayload.email = email; // Đảm bảo email luôn được lưu
        
        const { data, error } = await supabase
            .from('staff_list')
            .insert(dbPayload)
            .select()
            .single();

        if (error) {
            // Nếu insert staff lỗi, cần rollback xóa auth user
            await supabase.auth.admin.deleteUser(authData.user.id);
            return res.status(500).json({ error: `Lỗi lưu nhân sự db: ${error.message}` });
        }

        // 3. Update lại metadata của Auth user có chứa staff_id để nối kết (quan trọng cho Login script)
        await supabase.auth.admin.updateUserById(authData.user.id, {
            user_metadata: { staff_id: data.id, name: data.name }
        });

        // Trả về dạng camelCase cho frontend
        res.json({ success: true, staff: toCamelCase(data) });

    } catch (err) {
        console.error('[STAFF] Create error:', err);
        res.status(500).json({ error: 'Lỗi hệ thống.' });
    }
});

/**
 * POST /api/staff/update-password
 * Body: { staffId, newPassword, username }
 * Admin dùng để reset password nhân viên (thông qua Auth Admin)
 */
app.post('/api/staff/update-password', async (req, res) => {
    const { staffId, newPassword, email } = req.body;

    if (!staffId || !newPassword || !email) {
        return res.status(400).json({ error: 'Thiếu thông tin (Cần ID, pass mới và Email).' });
    }

    try {
        // Cần list Users để tìm theo Email ra UID, API admin không hỗ trợ update theo Email trực tiếp.
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        
        const targetUser = users.find(u => u.email === email);
        if (!targetUser) {
             return res.status(404).json({ error: 'Tài khoản Auth chưa đồng bộ.' });
        }

        // Gọi API admin update user
        const { error } = await supabase.auth.admin.updateUserById(targetUser.id, {
             password: newPassword
        });

        if (error) {
            return res.status(500).json({ error: `Lỗi cập nhật mật khẩu: ${error.message}` });
        }

        res.json({ success: true });

    } catch (err) {
        console.error('[STAFF] Update password error:', err);
        res.status(500).json({ error: 'Lỗi hệ thống.' });
    }
});

/**
 * Admin dùng để sửa thông tin nhân viên trong bảng `staff_list`
 * (vượt qua RLS do client SDK bị block quyền Update)
 */
app.post('/api/staff/update', async (req, res) => {
    const { id, ...updatedData } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Thiếu Staff ID.' });
    }

    try {
        // Chuyển camelCase từ frontend sang snake_case cho PostgreSQL
        const safeData = toSnakeCase(updatedData);
        
        // Loại bỏ password khỏi update thông thường (password quản lý riêng qua Auth API)
        delete safeData.password;
        // Loại bỏ id nếu bị lẫn vào body
        delete safeData.id;

        const { data, error } = await supabase
            .from('staff_list')
            .update(safeData)
            .eq('id', id)
            .select();

        if (error) throw error;
        // Trả về dạng camelCase cho frontend
        res.json({ success: true, staff: data ? toCamelCase(data[0]) : null });
    } catch (err) {
        console.error('Lỗi khi update staff list:', err);
        res.status(500).json({ error: 'Lỗi cập nhật CSDL: ' + err.message });
    }
});

/**
 * Xóa nhân viên khỏi `staff_list` và cố gắng xóa trên auth.users (nếu tìm thấy email)
 */
app.post('/api/staff/delete', async (req, res) => {
    const { id, email } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Thiếu Staff ID.' });
    }

    try {
        // Xóa bảng staff_list trước
        const { error: dbError } = await supabase.from('staff_list').delete().eq('id', id);
        if (dbError) throw dbError;

        // Xóa bảng auth.users
        if (email) {
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            if (!listError && users) {
                const targetUser = users.find(u => u.email === email);
                if (targetUser) {
                    await supabase.auth.admin.deleteUser(targetUser.id);
                }
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Lỗi khi xóa staff:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========================================
// P0.4: PROXY API ENDPOINTS 
// (YouTube + Gemini keys server-side)
// ========================================

/**
 * POST /api/youtube/channel-info
 * Body: { url, skipTopVideos? }
 * Server gọi YouTube API bằng key server-side
 */
app.post('/api/youtube/channel-info', async (req, res) => {
    const { url, skipTopVideos } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Thiếu URL kênh.' });
    }

    try {
        // Lấy API keys từ system_settings trong DB
        const { data: settings } = await supabase
            .from('system_settings')
            .select('youtube_api_keys')
            .single();

        const apiKeys = settings?.youtube_api_keys || [];
        if (apiKeys.length === 0) {
            return res.status(400).json({ error: 'Chưa cấu hình YouTube API Key trên server.' });
        }

        // Sử dụng key đầu tiên, rotate nếu lỗi quota
        let lastError = null;
        for (const keyObj of apiKeys) {
            const apiKey = typeof keyObj === 'string' ? keyObj : keyObj.key;
            if (!apiKey) continue;

            try {
                const result = await fetchChannelInfo(url, apiKey, skipTopVideos);
                return res.json(result);
            } catch (err) {
                lastError = err;
                if (err.message && (err.message.includes('quota') || err.message.includes('limit'))) {
                    console.log(`[YT] Key exhausted, rotating...`);
                    continue;
                }
                throw err;
            }
        }

        return res.status(429).json({ error: 'Tất cả API keys đã hết quota.' });

    } catch (err) {
        console.error('[YT] Channel info error:', err);
        res.status(500).json({ error: err.message || 'Lỗi khi lấy thông tin kênh.' });
    }
});

/**
 * POST /api/ai/analyze-topic
 * Body: { channelName, description, topics }
 * Server gọi Gemini API
 */
app.post('/api/ai/analyze-topic', async (req, res) => {
    const { channelName, description, topics } = req.body;

    try {
        const { data: settings } = await supabase
            .from('system_settings')
            .select('gemini_api_keys')
            .single();

        const geminiKeys = settings?.gemini_api_keys || [];
        if (geminiKeys.length === 0) {
            return res.status(400).json({ error: 'Chưa cấu hình Gemini API Key.' });
        }

        const apiKey = typeof geminiKeys[0] === 'string' ? geminiKeys[0] : geminiKeys[0].key;

        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Phân tích kênh YouTube "${channelName}".
Mô tả kênh: ${description || 'Không có'}
Danh sách chủ đề hiện có: ${topics.map(t => `${t.id}: ${t.name}`).join(', ')}

Hãy chọn tối đa 3 chủ đề phù hợp nhất từ danh sách trên. Nếu không có chủ đề nào phù hợp, đề xuất tạo mới.
Trả về JSON: { "suggestedTopicIds": ["id1", "id2"], "newTopics": [{"name": "...", "color": "#hex"}] }`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        const result = JSON.parse(response.text || '{}');
        res.json(result);

    } catch (err) {
        console.error('[AI] Analyze error:', err);
        res.status(500).json({ error: 'Lỗi phân tích AI.' });
    }
});

/**
 * POST /api/ai/generate
 * Body: { prompt, responseFormat? }
 * API chung cho các call Gemini AI
 */
app.post('/api/ai/generate', async (req, res) => {
    const { prompt, responseFormat } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Thiếu prompt.' });
    }

    try {
        const { data: settings } = await supabase
            .from('system_settings')
            .select('gemini_api_keys')
            .single();

        const geminiKeys = settings?.gemini_api_keys || [];
        if (geminiKeys.length === 0) {
            return res.status(400).json({ error: 'Chưa cấu hình Gemini API Key.' });
        }

        const apiKey = typeof geminiKeys[0] === 'string' ? geminiKeys[0] : geminiKeys[0].key;

        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const config = responseFormat === 'json'
            ? { responseMimeType: 'application/json' }
            : {};

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config
        });

        res.json({ text: response.text || '' });

    } catch (err) {
        console.error('[AI] Generate error:', err);
        res.status(500).json({ error: 'Lỗi AI.' });
    }
});

// ========================================
// GOOGLE TRENDS (giữ nguyên)
// ========================================

app.get('/api/trends', async (req, res) => {
    const keyword = req.query.keyword;
    if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
    }

    try {
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);

        const results = await googleTrends.interestOverTime({
            keyword: keyword,
            startTime: startDate,
            geo: 'VN',
        });

        const parsedData = JSON.parse(results);
        const timelineData = parsedData.default.timelineData;

        const formattedData = [];
        let currentMonth = '';
        let monthlyVolume = 0;
        let daysInMonth = 0;

        timelineData.forEach(item => {
            const date = new Date(item.time * 1000);
            const monthLabel = `T${date.getMonth() + 1}/${date.getFullYear().toString().substr(-2)}`;

            if (monthLabel !== currentMonth) {
                if (currentMonth !== '') {
                    formattedData.push({
                        month: currentMonth,
                        volume: Math.round(monthlyVolume / daysInMonth)
                    });
                }
                currentMonth = monthLabel;
                monthlyVolume = item.value[0];
                daysInMonth = 1;
            } else {
                monthlyVolume += item.value[0];
                daysInMonth += 1;
            }
        });
        if (currentMonth !== '') {
            formattedData.push({
                month: currentMonth,
                volume: Math.round(monthlyVolume / daysInMonth)
            });
        }

        res.json(formattedData);
    } catch (error) {
        console.error('Google Trends Error:', error);
        res.status(500).json({ error: 'Failed to fetch trends data' });
    }
});

// ========================================
// HELPER: YouTube Channel Info (server-side)
// ========================================

async function fetchChannelInfo(url, apiKey, skipTopVideos = false) {
    const BASE = 'https://www.googleapis.com/youtube/v3';

    // Extract channel identifier from URL
    let channelId = '';

    if (url.includes('/channel/')) {
        channelId = url.split('/channel/')[1].split(/[/?#]/)[0];
    } else {
        // Handle @username or /c/ URLs
        let handle = '';
        if (url.includes('/@')) {
            handle = url.split('/@')[1].split(/[/?#]/)[0];
        } else if (url.includes('/c/')) {
            handle = url.split('/c/')[1].split(/[/?#]/)[0];
        } else if (url.includes('/user/')) {
            handle = url.split('/user/')[1].split(/[/?#]/)[0];
        }

        if (handle) {
            const searchRes = await fetch(
                `${BASE}/search?part=snippet&q=${encodeURIComponent(handle)}&type=channel&maxResults=1&key=${apiKey}`
            );
            const searchData = await searchRes.json();

            if (searchData.error) {
                throw new Error(searchData.error.message);
            }

            if (searchData.items && searchData.items.length > 0) {
                channelId = searchData.items[0].id.channelId;
            }
        }
    }

    if (!channelId) {
        throw new Error('Không tìm thấy kênh. Vui lòng kiểm tra lại đường dẫn (URL) có chính xác không.');
    }

    // Fetch channel details
    const channelRes = await fetch(
        `${BASE}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
    );
    const channelData = await channelRes.json();

    if (channelData.error) {
        throw new Error(channelData.error.message);
    }

    if (!channelData.items || channelData.items.length === 0) {
        throw new Error('Không tìm thấy kênh. Vui lòng kiểm tra lại đường dẫn (URL) có chính xác không.');
    }

    const ch = channelData.items[0];
    const result = {
        name: ch.snippet.title,
        avatarUrl: ch.snippet.thumbnails?.medium?.url || ch.snippet.thumbnails?.default?.url || '',
        subscribers: parseInt(ch.statistics.subscriberCount) || 0,
        totalViews: parseInt(ch.statistics.viewCount) || 0,
        videoCount: parseInt(ch.statistics.videoCount) || 0,
        description: ch.snippet.description || '',
        channelId: channelId,
    };

    return result;
}

// Start server
app.listen(PORT, () => {
    console.log(`✅ DTA API Server running on http://localhost:${PORT}`);
    console.log(`   Auth: POST /api/auth/login`);
    console.log(`   YouTube: POST /api/youtube/channel-info`);
    console.log(`   AI: POST /api/ai/generate`);
    console.log(`   Trends: GET /api/trends?keyword=...`);
});
