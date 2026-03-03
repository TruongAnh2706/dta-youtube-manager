const express = require('express');
const cors = require('cors');
const googleTrends = require('google-trends-api');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/trends', async (req, res) => {
    const keyword = req.query.keyword;
    if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
    }

    try {
        // Lấy data trong 12 tháng gần nhất (geo: rỗng = toàn cầu, hoặc 'VN' nếu cần)
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);

        const results = await googleTrends.interestOverTime({
            keyword: keyword,
            startTime: startDate,
            geo: 'VN', // Giới hạn Việt Nam, nếu anh Trường thích toàn cầu thì có thể truyền query geo
        });

        const parsedData = JSON.parse(results);
        const timelineData = parsedData.default.timelineData;

        // Map lại data phù hợp với cấu trúc Recharts gồm {month, volume}
        // Gộp tháng lại
        const formattedData = [];
        let currentMonth = '';
        let monthlyVolume = 0;
        let daysInMonth = 0;

        timelineData.forEach(item => {
            // item.formattedTime ví dụ: "Jan 5, 2023" hoăc "May 2023" tuỳ time range
            const date = new Date(item.time * 1000);
            const monthLabel = `T${date.getMonth() + 1}/${date.getFullYear().toString().substr(-2)}`;

            if (monthLabel !== currentMonth) {
                if (currentMonth !== '') {
                    formattedData.push({
                        month: currentMonth,
                        volume: Math.round(monthlyVolume / daysInMonth) // Lấy trung bình cộng của tuần trong tháng
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
        // Push tháng cuối cùng
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

app.listen(PORT, () => {
    console.log(`✅ Google Trends Backend running on http://localhost:${PORT}`);
});
