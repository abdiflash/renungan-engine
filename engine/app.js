if (typeof CONFIG === "undefined") {
    throw new Error("CONFIG belum dimuat. Pastikan config.js dipanggil sebelum app.js");
}

const MODE = window.RENUNGAN_MODE || "UMUM";

/* ================= KONFIGURASI ================= */
const SHEET_ID = CONFIG.SHEET_ID;
const SHEET_GID = CONFIG.SHEET_GID;

/* ================= STATE ================= */
let allRenungan = [];
let currentCalendarDate = new Date();
const today = new Date();
today.setHours(0,0,0,0);

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('footerSchoolName').innerText = CONFIG.SCHOOL_NAME;
    document.getElementById('footerSchoolLink').innerText = CONFIG.SCHOOL_SITE;
    document.getElementById('footerSchoolLink').href = CONFIG.SCHOOL_URL;
    fetchData();
});

/* ================= FETCH DATA ================= */
async function fetchData() {
    const query = `SELECT A, B, C, D, E, F, G, H, I`; 
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&tq=${encodeURIComponent(query)}&gid=${SHEET_GID}`;

    try {
        const res = await fetch(url);
        const text = await res.text();
        const jsonText = text.substring(47).slice(0, -2);
        const json = JSON.parse(jsonText);

        parseData(json.table.rows);
        
        const todayStr = formatDateKey(today);
        const todayData = allRenungan.find(r => r.key === todayStr);

        document.getElementById('loader').classList.add('hidden');

        if (todayData) {
            renderRenungan(todayData);
            loadHitCounter();
        } else {
            document.getElementById('emptyState').classList.remove('hidden');
        }

        // Panggil Hit Counter setelah data termuat
        if (typeof loadHitCounter === 'function') {
            loadHitCounter();
        }

    } catch (error) {
        console.error(error);
        alert("Gagal memuat data: " + error.message);
    }
}

function parseData(rows) {
    allRenungan = rows.map(row => {
        const v = (i) => (row.c[i] ? row.c[i].v : '');
        let d = null;
        let rawDate = v(0); 

        if (rawDate !== '' && rawDate !== null) {
            if (typeof rawDate === 'number') {
                d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            } else if (typeof rawDate === 'string' && rawDate.includes('Date')) {
                const parts = rawDate.match(/Date\((\d+),(\d+),(\d+)\)/);
                if(parts) d = new Date(parts[1], parts[2], parts[3]);
            } else if (typeof rawDate === 'string') {
                const clean = rawDate.replace(/-/g, '/'); 
                if (clean.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                    const p = clean.split('/');
                    const n1 = parseInt(p[0]); const n2 = parseInt(p[1]); const n3 = parseInt(p[2]);
                    if (n1 > 12) d = new Date(n3, n2 - 1, n1);
                    else d = new Date(n3, n1 - 1, n2);
                }
            }
        }

        const statusRaw = String(v(8)).toLowerCase().trim();
        if (!d || isNaN(d.getTime())) return null;

        let finalAudio = v(6);
        if (finalAudio && typeof finalAudio === 'string' && finalAudio.includes('dropbox.com')) {
            finalAudio = finalAudio.replace(/dl=0/g, 'raw=1').replace(/dl=1/g, 'raw=1');
            if (!finalAudio.includes('raw=1')) {
                finalAudio += finalAudio.includes('?') ? '&raw=1' : '?raw=1';
            }
        }

        return {
            key: formatDateKey(d),
            dateObj: d,
            judul: v(1),
            ayat: v(2),
            ayatText: v(3),
            teks: v(4),
            refleksi: v(5),
            audioUrl: finalAudio, 
            tahunAjaran: v(7),
            status: statusRaw
        };
    }).filter(item => item && item.status === 'published');
}

/* ================= RENDER LOGIC ================= */
function renderRenungan(data) {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('calendar').classList.add('hidden');
    document.getElementById('renungan').classList.remove('hidden');

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('displayDate').innerText = data.dateObj.toLocaleDateString('id-ID', options);
    document.getElementById('displayJudul').innerText = data.judul;
    document.getElementById('displayAyat').innerText = data.ayat;
    document.getElementById('displayAyatText').innerText = `"${data.ayatText}"`;
    document.getElementById('displayIsi').innerHTML = data.teks.replace(/\n/g, '<br>');
    document.getElementById('displayRefleksi').innerText = data.refleksi;

    const yearElement = document.getElementById('academicYear');
    if (yearElement) {
        yearElement.innerText = data.tahunAjaran || "2025/2026";
    }
    
    setupAudioPlayer(data.audioUrl);
}

/* ================= LOGIKA AUDIO (MENGGUNAKAN VERSI BACKUP ANDA) ================= */
function setupAudioPlayer(urlRaw) {
    const player = document.getElementById('audioPlayer');
    const btn = document.getElementById('audioControl');
    const source = document.getElementById('audioSource');

    if (!player || !btn || !source) return;

    player.pause();
    player.currentTime = 0;
    
    // Sembunyikan dulu di awal
    player.style.display = 'none';
    btn.style.display = 'none';
    
    if (urlRaw && urlRaw.trim() !== "") {
        let finalUrl = urlRaw.trim();
        if (!finalUrl.startsWith('http')) {
            finalUrl = `assets/audio/${finalUrl}`;
        }

        source.src = finalUrl;
        player.load(); 

        // Tampilkan tombol dan slider
        btn.style.display = 'inline-flex';
        btn.innerHTML = '▶️ Putar Audio';
        btn.disabled = false;
        
        // Memunculkan slider audio di bawah tombol
        player.style.display = 'block'; 
        player.style.marginTop = '15px';
        player.style.width = '100%';

        player.onwaiting = () => {
            btn.innerHTML = '⏳ Memuat...';
            btn.disabled = true;
        };

        player.onplaying = () => {
            btn.innerHTML = '⏸️ Pause Audio';
            btn.disabled = false;
        };

        player.onpause = () => {
            btn.innerHTML = '▶️ Lanjutkan Audio';
            btn.disabled = false;
        };

        player.onended = () => {
            btn.innerHTML = '▶️ Putar Ulang';
            // Slider tetap dibiarkan muncul agar bisa digeser manual
            player.style.display = 'block'; 
        };

        player.onerror = () => {
            btn.innerHTML = '⚠️ Gagal Memuat';
            btn.disabled = true;
            player.style.display = 'none';
        };

    } else {
        btn.style.display = 'none';
        player.style.display = 'none';
    }
}

function toggleAudio() {
    const player = document.getElementById('audioPlayer');
    if (!player) return;

    if (player.paused) {
        player.play().catch(e => console.warn("Playback blocked:", e));
    } else {
        player.pause();
    }
}

/* ================= KALENDER LOGIC ================= */
function showCalendarView() {
    document.getElementById('renungan').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('calendar').classList.remove('hidden');
    renderCalendar();
}

function hideCalendarView() {
    if (document.getElementById('displayJudul').innerText === "") {
         document.getElementById('calendar').classList.add('hidden');
         document.getElementById('emptyState').classList.remove('hidden');
    } else {
         document.getElementById('calendar').classList.add('hidden');
         document.getElementById('renungan').classList.remove('hidden');
    }
}

function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.innerHTML = ''; 

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    document.getElementById('calendarMonthLabel').innerText = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        const empty = document.createElement('div');
        empty.className = 'date-cell empty';
        grid.appendChild(empty);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dateCheck = new Date(year, month, i);
        dateCheck.setHours(0,0,0,0);
        const dateKey = formatDateKey(dateCheck);
        
        const cell = document.createElement('div');
        cell.className = 'date-cell';
        cell.innerText = i;

        if (dateKey === formatDateKey(today)) {
            cell.classList.add('today');
        }

        // ==============================
        // LOGIKA MODE UMUM / KHUSUS
        // ==============================
        if (MODE === "UMUM" && dateCheck > today) {
            cell.classList.add('locked');
            cell.onclick = () => alert("⏳ Renungan belum dibuka. Silakan kembali besok.");
        } else {
            const dataRenungan = allRenungan.find(r => r.key === dateKey);
            if (dataRenungan) {
                cell.classList.add('available', 'has-renungan');
                cell.onclick = () => renderRenungan(dataRenungan);
            } else {
                cell.style.opacity = '0.5';
            }
        }

        grid.appendChild(cell);
    }
}

function formatDateKey(date) {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset*60*1000));
    return localDate.toISOString().split('T')[0];
}

/* ================= HIT COUNTER LOGIC (ANTI-ERROR) ================= */
async function loadHitCounter() {
    const countElement = document.getElementById('count');
    if (!countElement) return;

    const namespace = CONFIG.COUNTER_NAMESPACE || "default-renungan";
const key = CONFIG.COUNTER_KEY || "visitor_count";

    try {
        // 1. Mencoba ambil data real dari API
        const response = await fetch(`https://api.countapi.xyz/hit/${namespace}/${key}`);
        const data = await response.json();

        if (data && data.value) {
            animateValue(countElement, 0, data.value, 1000);
            localStorage.setItem('visitor_sim', data.value); // Sinkronisasi cadangan
        } else {
            throw new Error('Data invalid');
        }
    } catch (error) {
        // 2. Jika API gagal, gunakan simulasi lokal agar angka tidak "macet"
        console.warn("Counter API offline, menggunakan simulasi.");
        
        let savedCount = parseInt(localStorage.getItem('visitor_sim')) || 100;
        savedCount += 1; // Tambah 1 setiap refresh
        
        localStorage.setItem('visitor_sim', savedCount);
        animateValue(countElement, 0, savedCount, 1000);
    }
}

// Fungsi animasi angka menghitung
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString('id-ID');
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
