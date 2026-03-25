require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_PASSWORD = 'Dta@2026';

async function migrateAuth() {
    console.log('🔄 Đang bắt đầu quá trình đồng bộ sang Supabase Auth...');

    const { data: staffList, error } = await supabase.from('staff_list').select('*');
    if (error) {
         console.error('❌ Lỗi khi lấy danh sách nhân viên:', error);
         return;
    }

    console.log(`👤 Tìm thấy ${staffList.length} nhân sự. Bắt đầu tạo tài khoản Auth...`);

    let successCount = 0;
    let skipCount = 0;

    for (const staff of staffList) {
        if (!staff.username) {
            console.log(`⚠️ Bỏ qua nhân sự chưa có username: ${staff.name}`);
            continue;
        }

        const email = `${staff.username.toLowerCase().trim()}@dtastudio.vn`;

        // Gọi API tạo Auth User bằng Admin SDK
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: { staff_id: staff.id, name: staff.name }
        });

        if (authError) {
             // Thường lỗi do Email đã tồn tại
             console.log(`⚠️ Bỏ qua (${staff.username}):`, authError.message);
             skipCount++;
        } else {
             console.log(`✅ Đã tạo thành công: ${email}`);
             successCount++;
        }
    }
    
    console.log('-----------------------------------');
    console.log(`🎉 Tạo mới: ${successCount}`);
    console.log(`ℹ️ Bỏ qua (Đã tồn tại hoặc lỗi): ${skipCount}`);
    console.log('🏁 Hoàn tất đồng bộ!');
}

migrateAuth();
