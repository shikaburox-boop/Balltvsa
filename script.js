// === ตั้งค่า SUPABASE CONFIG ===
const SUPABASE_URL = "https://saxvncakpljuzyhhuqcv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNheHZuY2FrcGxqdXp5aGh1cWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjI3NDgsImV4cCI6MjEwNzYzODc0OH0.OJqvx5cvJ3VMcPFsOZ7o1PsrtI_6Wzgo_4Wds_k9Hfk";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

function showMessage(msg, isError = false) {
    const msgBox = document.getElementById('auth-msg');
    msgBox.textContent = msg;
    msgBox.style.display = 'block';
    msgBox.style.background = isError ? 'rgba(248, 81, 73, 0.15)' : 'rgba(46, 160, 67, 0.15)';
    msgBox.style.color = isError ? '#f85149' : '#3fb950';
    msgBox.style.border = isError ? '1px solid rgba(248, 81, 73, 0.4)' : '1px solid rgba(46, 160, 67, 0.4)';
}

// ตรวจสอบการล็อกอินค้างไว้จาก LocalStorage
async function checkAuthStatus() {
    const savedUser = localStorage.getItem("balltvsa_user");
    if (savedUser) {
        const { data, error } = await db
            .from('profiles')
            .select('*')
            .eq('username', savedUser)
            .maybeSingle();

        if (data && !error) {
            currentUser = data;
            showDashboard();
        }
    }
    loadLeaderboard();
    setupRealtimeSubscription(); // เปิดใช้งาน Real-time อัปเดตตารางอันดับสดๆ
}
checkAuthStatus();

// ดึงตารางจัดอันดับ High Score ของทุกคน
async function loadLeaderboard() {
    const { data, error } = await db
        .from('profiles')
        .select('username, high_score')
        .order('high_score', { ascending: false })
        .limit(5);

    const listEl = document.getElementById("leaderboard-list");
    if (error || !data || data.length === 0) {
        listEl.innerHTML = "<p style='color: #8b949e; text-align: center; font-size: 12px;'>ยังไม่มีข้อมูลผู้เล่น</p>";
        return;
    }

    let html = "";
    data.forEach((row, index) => {
        let rankColor = index === 0 ? "#ffcc00" : (index === 1 ? "#c0c0c0" : (index === 2 ? "#cd7f32" : "#c9d1d9"));
        html += `<div class="lb-item">
            <span><span style="color: ${rankColor}; font-weight: bold;">#${index + 1}</span> ${row.username}</span>
            <span style="color: #3fb950; font-weight: bold;">${row.high_score || 0} pts</span>
        </div>`;
    });
    listEl.innerHTML = html;
}

// ⚡ ฟังก์ชันตั้งค่า Supabase Realtime ฟังการเปลี่ยนแปลงตาราง profiles
function setupRealtimeSubscription() {
    db.channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          loadLeaderboard(); // รีเฟรชตารางอัตโนมัติทันทีที่มีการเปลี่ยนแปลงในฐานข้อมูล
      })
      .subscribe();
}

// สมัครสมาชิก
async function handleRegister() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        showMessage('กรุณากรอก Username และ Password ให้ครบถ้วน', true);
        return;
    }

    const { data: existingUser } = await db
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

    if (existingUser) {
        showMessage('Username นี้มีผู้ใช้งานแล้ว!', true);
        return;
    }

    const { error } = await db
        .from('profiles')
        .insert([{ username: username, password: password, high_score: 0 }]);

    if (error) {
        showMessage('เกิดข้อผิดพลาด: ' + error.message, true);
    } else {
        showMessage('สมัครสมาชิกสำเร็จ! สามารถเข้าสู่ระบบได้เลย');
    }
}

// เข้าสู่ระบบ
async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        showMessage('กรุณากรอก Username และ Password', true);
        return;
    }

    const { data, error } = await db
        .from('profiles')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle();

    if (error || !data) {
        showMessage('Username หรือ Password ไม่ถูกต้อง!', true);
    } else {
        currentUser = data;
        localStorage.setItem("balltvsa_user", currentUser.username);
        showDashboard();
    }
}

// แสดงหน้า Dashboard
function showDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('display-name').textContent = currentUser.username;
    document.getElementById('high-score').textContent = currentUser.high_score || 0;
    loadLeaderboard();
}

// ออกจากระบบ
function logout() {
    localStorage.removeItem("balltvsa_user");
    currentUser = null;
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('auth-msg').style.display = 'none';
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('auth-section').classList.remove('hidden');
    loadLeaderboard();
}