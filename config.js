// ใส่ค่าจาก Supabase: Project Settings → API
// (anon public key ออกแบบมาให้เปิดเผยในเว็บได้ ความปลอดภัยอยู่ที่นโยบาย RLS ใน supabase.sql)
window.APP_CONFIG = {
  SUPABASE_URL: "https://saxvncakpljuzyhhuqcv.supabase.co",       // เช่น "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNheHZuY2FrcGxqdXp5aGh1cWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjI3NDgsImV4cCI6MjEwNzYzODc0OH0.OJqvx5cvJ3VMcPFsOZ7o1PsrtI_6Wzgo_4Wds_k9Hfk",  // คีย์ "anon" "public"
  DEFAULT_BOARD: "main"   // ห้องเริ่มต้น เปลี่ยนห้องได้ด้วย ?board=ชื่อห้อง ต่อท้ายลิงก์
};
