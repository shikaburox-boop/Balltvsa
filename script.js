const SUPABASE_URL = "https://saxvncakpljuzyhhuqcv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNheHZuY2FrcGxqdXp5aGh1cWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjI3NDgsImV4cCI6MjEwNzYzODc0OH0.OJqvx5cvJ3VMcPFsOZ7o1PsrtI_6Wzgo_4Wds_k9Hfk";
 
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 
const TOKEN_KEY = "balltvsa_token";
 
let currentUser = null; // { id, username, high_score }
let currentClickScore = 0;
let saveTimeout = null;
let pendingSave = false;
let lbTimeout = null;
let realtimeStarted = false;
 
const getToken = () => localStorage.getItem(TOKEN_KEY);
 
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}
 
function showMessage(msg, isError = false) {
    const msgBox = document.getElementById('auth-msg');
    msgBox.textContent = msg;
    msgBox.style.display = 'block';
    msgBox.style.background = isError ? 'rgba(248, 81, 73, 0.15)' : 'rgba(46, 160, 67, 0.15)';
    msgBox.style.color = isError ? '#f85149' : '#3fb950';
    msgBox.style.border = isError ? '1px solid rgba(248, 81, 73, 0.4)' : '1px solid rgba(46, 160, 67, 0.4)';
}
 
// ---------- Session / Auth ----------
async function checkAuthStatus() {
    const token = getToken();
    if (token) {
        const { data, error } = await db.rpc('get_me', { p_token: token });
        if (!error && data) {
            currentUser = data;
            currentClickScore = data.high_score || 0;
            showDashboard();
        } else if (!error) {
            localStorage.removeItem(TOKEN_KEY); // token หมดอายุหรือไม่ถูกต้อง
        }
    }
    loadLeaderboard();
    setupRealtimeSubscription();
}
checkAuthStatus();
 
function validateInputs(username, password) {
    if (!username || !password) {
        showMessage('กรุณากรอก Username และ Password ให้ครบถ้วน', true);
        return false;
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        showMessage('Username ใช้ได้เฉพาะ A-Z, 0-9, _ ความยาว 3-20 ตัวอักษร', true);
        return false;
    }
    if (password.length < 4) {
        showMessage('Password ต้องมีอย่างน้อย 4 ตัวอักษร', true);
        return false;
    }
    return true;
}
 
async function handleRegister() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!validateInputs(username, password)) return;
 
    const { error } = await db.rpc('register_user', { p_username: username, p_password: password });
 
    if (error) {
        const msg = error.message || '';
        if (msg.includes('username_taken')) showMessage('Username นี้มีผู้ใช้งานแล้ว!', true);
        else if (msg.includes('invalid_username')) showMessage('Username ไม่ถูกต้อง (A-Z, 0-9, _ ยาว 3-20 ตัว)', true);
        else if (msg.includes('invalid_password')) showMessage('Password ต้องยาว 4-72 ตัวอักษร', true);
        else showMessage('เกิดข้อผิดพลาด: ' + msg, true);
        return;
    }
    showMessage('สมัครสมาชิกสำเร็จ! สามารถเข้าสู่ระบบได้เลย');
}
 
async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
 
    if (!username || !password) {
        showMessage('กรุณากรอก Username และ Password', true);
        return;
    }
 
    const { data, error } = await db.rpc('login_user', { p_username: username, p_password: password });
 
    if (error || !data) {
        const msg = error?.message || '';
        if (!error || msg.includes('invalid_credentials')) {
            showMessage('Username หรือ Password ไม่ถูกต้อง!', true);
        } else {
            showMessage('เกิดข้อผิดพลาด: ' + msg, true);
        }
        return;
    }
 
    localStorage.setItem(TOKEN_KEY, data.token);
    currentUser = { id: data.id, username: data.username, high_score: data.high_score };
    currentClickScore = currentUser.high_score || 0;
    showDashboard();
}
 
async function logout() {
    await flushScore();
    const token = getToken();
    if (token) await db.rpc('logout_user', { p_token: token });
    localStorage.removeItem(TOKEN_KEY);
    resetToLoginScreen();
}
 
function resetToLoginScreen() {
    currentUser = null;
    currentClickScore = 0;
    pendingSave = false;
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('auth-msg').style.display = 'none';
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('auth-section').classList.remove('hidden');
    loadLeaderboard();
}
 
function showDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('display-name').textContent = currentUser.username;
    document.getElementById('high-score').textContent = currentUser.high_score || 0;
    document.getElementById('current-score').textContent = currentClickScore;
    loadLeaderboard();
}
 
// ---------- Leaderboard (Real-time) ----------
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
        const rankColor = index === 0 ? "#ffcc00" : (index === 1 ? "#c0c0c0" : (index === 2 ? "#cd7f32" : "#c9d1d9"));
        html += `<div class="lb-item">
            <span><span style="color: ${rankColor}; font-weight: bold;">#${index + 1}</span> ${escapeHtml(row.username)}</span>
            <span style="color: #3fb950; font-weight: bold;">${Number(row.high_score) || 0} pts</span>
        </div>`;
    });
    listEl.innerHTML = html;
}
 
// หน่วงการโหลดซ้ำ ไม่ให้ยิง query ถี่เกินไปตอนมีคนคลิกรัว ๆ
function scheduleLeaderboardReload() {
    clearTimeout(lbTimeout);
    lbTimeout = setTimeout(loadLeaderboard, 400);
}
 
function setupRealtimeSubscription() {
    if (realtimeStarted) return;
    realtimeStarted = true;
    db.channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleLeaderboardReload)
      .subscribe();
}
 
// ---------- Auto-save ----------
async function flushScore() {
    clearTimeout(saveTimeout);
    if (!pendingSave || !currentUser) return;
    pendingSave = false;
 
    const { data, error } = await db.rpc('submit_score', { p_token: getToken(), new_score: currentClickScore });
 
    if (error) {
        console.warn('save failed:', error.message);
        if ((error.message || '').includes('invalid_session')) {
            localStorage.removeItem(TOKEN_KEY);
            resetToLoginScreen();
            showMessage('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', true);
            return;
        }
        // ถูกปฏิเสธ (เช่น คลิกเร็วผิดปกติ) -> กลับไปใช้คะแนนที่ยืนยันแล้ว
        const { data: me } = await db.rpc('get_me', { p_token: getToken() });
        if (me) {
            currentUser.high_score = me.high_score;
            currentClickScore = me.high_score;
            document.getElementById('high-score').textContent = me.high_score;
            document.getElementById('current-score').textContent = me.high_score;
        }
        return;
    }
    if (typeof data === 'number') currentUser.high_score = Math.max(currentUser.high_score || 0, data);
}
 
function addPoint() {
    if (!currentUser) return;
 
    currentClickScore++;
    document.getElementById('current-score').textContent = currentClickScore;
 
    if (currentClickScore > (currentUser.high_score || 0)) {
        document.getElementById('high-score').textContent = currentClickScore;
        pendingSave = true;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(flushScore, 500);
    }
}
 
// บันทึกทันทีเมื่อสลับแท็บ/ปิดหน้า กันคะแนนล่าสุดหาย
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushScore();
});
window.addEventListener('pagehide', flushScore);
 
