const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rjtjmxggtklafaprlmqb.supabase.co';
const supabaseKey = 'sb_publishable_vcqzNjIppqytoWk64vIoFA_e1BCBq0Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log("Testing insert...");
  const newChannel = {
    id: 'test_channel_123',
    name: 'Test Channel',
    url: 'https://youtube.com/test',
    avatar_url: '',
    topic_ids: [],
    rating: 3,
    upload_frequency: 'Hàng tuần',
    average_views: 0,
    subscribers: 0,
    total_views: 0,
    video_count: 0,
    published_at: '',
    description: '',
    latest_videos: [],
    top_videos: [],
    notes: '',
    country: 'Vietnam'
  };

  const { data, error } = await supabase
    .from('source_channels')
    .upsert([newChannel]);

  if (error) {
    console.error("Upsert failed:", error);
  } else {
    console.log("Upsert success:", data);
  }
}

testInsert();
