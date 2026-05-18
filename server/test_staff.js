// Use native fetch

async function testStaffCreation() {
    console.log("Đang test gọi API tạo staff...");
    try {
        const response = await fetch('http://localhost:3001/api/staff/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: crypto.randomUUID(),
                name: 'Test Staff',
                role: 'member',
                email: 'test_staff_' + Date.now() + '@dtastudio.com',
                phone: '0123456789',
                password: 'TestPassword123',
                username: 'teststaff' + Date.now(),
                assignedChannelIds: [],
                status: 'online',
                baseSalary: 5000000,
                managedEmailCount: 0,
                kpiTargets: { daily: 1, weekly: 6, monthly: 26 },
                skills: []
            })
        });

        const result = await response.json();
        console.log("Kết quả HTTP:", response.status);
        console.log("Kết quả Data:", result);
    } catch (e) {
        console.error("Lỗi:", e);
    }
}

testStaffCreation();
