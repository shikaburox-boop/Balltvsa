// ใส่ค่าจาก Supabase: Project Settings → API
// (anon public key ออกแบบมาให้เปิดเผยในเว็บได้ ความปลอดภัยอยู่ที่นโยบาย RLS ใน supabase.sql)
window.APP_CONFIG = {
  SUPABASE_URL: "",       // เช่น "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "",  // คีย์ "anon" "public"
  DEFAULT_BOARD: "main"   // ห้องเริ่มต้น เปลี่ยนห้องได้ด้วย ?board=ชื่อห้อง ต่อท้ายลิงก์
};
