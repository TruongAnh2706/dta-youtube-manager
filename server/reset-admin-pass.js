// Script reset password admin trên Supabase Auth
// Chạy: node reset-admin-pass.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_EMAIL = 'ductruong.onl@gmail.com';
const NEW_PASSWORD = 'Dta@2026'; // Password mới (>= 6 ký tự)

async function resetAdminPassword() {
    console.log('🔍 Đang tìm tài khoản admin trên Supabase Auth...');
    
    // 1. List all auth users to find admin
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
        console.error('❌ Lỗi khi list users:', listError.message);
        return;
    }
    
    const adminUser = users.find(u => u.email === ADMIN_EMAIL);
    
    if (adminUser) {
        // Admin đã có trên Auth → update password
        console.log(`✅ Tìm thấy tài khoản Auth: ${adminUser.email} (id: ${adminUser.id})`);
        console.log(`📝 Metadata hiện tại:`, JSON.stringify(adminUser.user_metadata));
        
        const { error: updateError } = await supabase.auth.admin.updateUserById(adminUser.id, {
            password: NEW_PASSWORD,
            user_metadata: { staff_id: 'dta_admin_01', name: 'Đức Trường (CEO)' }
        });
        
        if (updateError) {
            console.error('❌ Lỗi update password:', updateError.message);
        } else {
            console.log(`✅ Đã reset password thành công!`);
            console.log(`📧 Email: ${ADMIN_EMAIL}`);
            console.log(`🔑 Password mới: ${NEW_PASSWORD}`);
        }
    } else {
        // Admin chưa có trên Auth → tạo mới
        console.log('⚠️ Chưa tìm thấy tài khoản Auth. Đang tạo mới...');
        
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: NEW_PASSWORD,
            email_confirm: true,
            user_metadata: { staff_id: 'dta_admin_01', name: 'Đức Trường (CEO)' }
        });
        
        if (createError) {
            console.error('❌ Lỗi tạo Auth user:', createError.message);
        } else {
            console.log(`✅ Đã tạo tài khoản Auth mới thành công!`);
            console.log(`📧 Email: ${ADMIN_EMAIL}`);
            console.log(`🔑 Password: ${NEW_PASSWORD}`);
            console.log(`🆔 Auth UID: ${newUser.user.id}`);
        }
    }
    
    // 2. Kiểm tra staff_list có đúng email không
    const { data: staff, error: staffError } = await supabase
        .from('staff_list')
        .select('id, name, email, role')
        .eq('id', 'dta_admin_01')
        .single();
    
    if (staff) {
        console.log(`\n📋 Staff DB record: id=${staff.id}, name=${staff.name}, email=${staff.email}, role=${staff.role}`);
        
        // Đảm bảo email trong staff_list khớp
        if (staff.email !== ADMIN_EMAIL) {
            await supabase.from('staff_list').update({ email: ADMIN_EMAIL }).eq('id', 'dta_admin_01');
            console.log(`🔄 Đã đồng bộ email trong staff_list → ${ADMIN_EMAIL}`);
        }
    } else {
        console.log('⚠️ Không tìm thấy record admin trong staff_list!', staffError?.message);
    }
    
    console.log('\n🎉 Hoàn tất! Hãy đăng nhập lại với:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
}

resetAdminPassword().catch(err => console.error('Fatal:', err));
