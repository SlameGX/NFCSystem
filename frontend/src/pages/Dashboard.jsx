import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const [scanHistory, setScanHistory] = useState([]);
    const [showAddStudent, setShowAddStudent] = useState(false);
    const [showDeleteStudent, setShowDeleteStudent] = useState(false);

    // Attendance & Settings
    // Helper for Local Date (YYYY-MM-DD)
    const getLocalDate = () => {
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };

    const [lessonStartTime, setLessonStartTime] = useState('09:00');
    const [lessonEndTime, setLessonEndTime] = useState('10:00');
    const [dailyAttendance, setDailyAttendance] = useState([]);
    const [selectedDate, setSelectedDate] = useState(getLocalDate()); // Attendance List Date

    // Auto-update date at midnight
    useEffect(() => {
        const interval = setInterval(() => {
            const current = getLocalDate();
            if (current !== selectedDate) {
                // If the app has been open overnight, switch to new day if user was on "yesterday" (effectively previous today)
                // Or simply force update if the purpose is to "show today's data" for a kiosk.
                // We'll update only if the stored date is yesterday (1 day behind) to avoid disrupting browsing.
                // Simpler logic: Just update it.
                setSelectedDate(current);
            }
        }, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [selectedDate]);

    // NEW: Settings Date
    const [settingsDate, setSettingsDate] = useState(''); // Empty = Global Default
    const [isCustomSchedule, setIsCustomSchedule] = useState(false);

    const [studentName, setStudentName] = useState('');
    const [courseGroup, setCourseGroup] = useState(''); // NEW
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [nfcUid, setNfcUid] = useState('');
    const [isReadingNfc, setIsReadingNfc] = useState(false);

    const navigate = useNavigate();

    // NFC MODE: add / delete
    const [nfcMode, setNfcMode] = useState(null);

    // 1. Fetch Settings (Run on mount and when settingsDate changes)
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Fetch schedule for specific date or global
                const res = await axios.get(`/api/settings/schedule?date=${settingsDate}`);
                setLessonStartTime(res.data.lessonStartTime || res.data.startTime || '09:00');
                setLessonEndTime(res.data.lessonEndTime || res.data.endTime || '10:00');
                setIsCustomSchedule(!!res.data.isCustom);
            } catch { }
        };
        fetchSettings();
    }, [settingsDate]);

    // 2. Fetch Live Data (History & Attendance) - Run periodically
    useEffect(() => {
        const fetchLiveData = async () => {
            // History
            try {
                const res = await axios.get('/api/scan-history');
                if (Array.isArray(res.data)) setScanHistory(res.data);
            } catch { }

            // Daily Attendance
            fetchDailyAttendance(selectedDate);
        };

        fetchLiveData(); // Initial
        const interval = setInterval(fetchLiveData, 3000);
        return () => clearInterval(interval);
    }, [selectedDate]);

    const fetchDailyAttendance = async (date) => {
        try {
            const res = await axios.get(`/api/attendance/daily?date=${date}`);
            setDailyAttendance(res.data);
        } catch { }
    };

    const handleSimulation = async (uid) => {
        try {
            // ❌ /api/simulate-scan yok
            // ✅ backend’de simüle etmek için check-nfc kullanıyoruz
            await axios.post('/api/check-nfc', { nfcData: uid });
        } catch (err) {
            console.error('Simulate scan error:', err);
        }
    };

    // Updated NFC Read Handler with TOGGLE logic
    const startNfcRead = async () => {
        // If already reading, STOP it
        if (isReadingNfc) {
            try {
                // We send a cancel request to backend
                await axios.post('/api/nfc/cancel');
                setIsReadingNfc(false);
                setNfcUid(''); // Clear partial data
            } catch (error) {
                console.error('Stop error', error);
            }
            return;
        }

        // Start reading
        try {
            setIsReadingNfc(true);
            setNfcUid('');
            const endpoint = nfcMode === 'add' ? '/api/nfc/start-wait' : '/api/nfc/start-delete';
            await axios.post(endpoint);

            // Polling for NFC data
            const pollInterval = setInterval(async () => {
                try {
                    // Check if cancelled locally
                    if (!isReadingNfc) {
                        clearInterval(pollInterval);
                        return;
                    }

                    const res = await axios.get('/api/nfc/latest');
                    if (res.data.uid) {
                        setNfcUid(res.data.uid);
                        setIsReadingNfc(false);
                        clearInterval(pollInterval);
                    }
                } catch (e) {
                    // ignore errors during poll
                }
            }, 1000);

        } catch (err) {
            console.error(err);
            setIsReadingNfc(false);
            alert('NFC Modu başladıla bilmədi');
        }
    };

    const handleSaveStudent = async () => {
        if (!studentName || !username || !password || !nfcUid) return alert('Bütün xanaları doldurun');
        try {
            // ✅ backend: POST /api/students
            await axios.post('/api/students', { name: studentName, courseGroup, username, password, nfcUid });
            setShowAddStudent(false);
            resetForm();
        } catch (err) {
            alert(err.response?.data?.message || 'Tələbə qeyd edilərkən xəta baş verdi');
        }
    };

    const handleDeleteStudent = async () => {
        if (!nfcUid) return alert('Zəhmət olmasa NFC kartını oxudun');
        try {
            // ❌ axios.delete(`/api/students/${nfcUid}`) backend’de yok
            // ✅ backend: POST /api/students/delete  body: { nfcUid }
            await axios.post('/api/students/delete', { nfcUid });
            setShowDeleteStudent(false);
            resetForm();
        } catch (err) {
            alert(err.response?.data?.message || 'Tələbə silinərkən xəta baş verdi');
        }
    };

    const resetForm = () => {
        setStudentName('');
        setCourseGroup('');
        setUsername('');
        setPassword('');
        setNfcUid('');
        setIsReadingNfc(false);
        setNfcMode(null);
    };

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    const handleSaveSettings = async () => {
        try {
            await axios.post('/api/settings/schedule', {
                date: settingsDate, // Optional: if empty, saves as global
                startTime: lessonStartTime,
                endTime: lessonEndTime
            });
            alert('Ayarlar yadda saxlanıldı ✅');
        } catch {
            alert('Xəta baş verdi');
        }
    };

    return (
        <div className="container animate-fade-in" style={{ opacity: 1, visibility: 'visible', display: 'block' }}>
            {/* NAVBAR */}
            <nav className="nav glass" style={{ padding: '1.2rem 2.5rem', borderRadius: '20px', marginBottom: '4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="logo" style={{ fontSize: '1.8rem', fontWeight: 800 }}>EduPass</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ padding: '0.4rem 1.2rem', background: 'rgba(0, 243, 255, 0.1)', borderRadius: '100px', fontSize: '0.85rem', color: 'var(--primary)', border: '1px solid var(--glass-border)', fontWeight: 600 }}>Admin Paneli</div>
                    <button onClick={handleLogout} className="btn" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px' }}>Çıxış</button>
                </div>
            </nav>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '3rem', marginBottom: '3rem' }}>
                {/* LEFT: HISTORY */}
                <div className="glass" style={{ padding: '2.5rem', borderRadius: '32px', height: '700px', display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '2.5rem' }}>Son Oxunan Kartlar</h2>
                    <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                        {scanHistory.length === 0 ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, fontSize: '1.2rem' }}>Hələ kart oxudulmadı...</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                {scanHistory.map((scan, index) => (
                                    <div key={index} className="glass" style={{ padding: '1.25rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '1.5rem', background: scan?.found ? 'rgba(57, 255, 20, 0.05)' : 'rgba(255, 49, 49, 0.05)' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: scan?.found ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 49, 49, 0.1)', color: scan?.found ? 'var(--success)' : 'var(--error)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                            {scan?.found ? '✓' : '✕'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{scan?.message || 'Naməlum hərəkət'}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                🕒 {scan?.timestamp ? new Date(scan.timestamp).toLocaleTimeString() : '--:--'} • 🆔 {scan?.uid || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: ACTIONS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                    <div className="glass" style={{ padding: '2.5rem', borderRadius: '32px' }}>
                        <h3 style={{ marginBottom: '2rem', color: 'var(--primary)', fontSize: '1.4rem' }}>🛠 Simulyasiya</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <button className="btn" onClick={() => handleSimulation('0x00 0x00')} style={{ height: '110px', borderRadius: '28px', background: 'linear-gradient(135deg, #10b981, #34d399)', color: 'white' }}>✓ DÜZGÜN KART</button>
                            <button className="btn" onClick={() => handleSimulation('0x99 0x99')} style={{ height: '110px', borderRadius: '28px', background: 'linear-gradient(135deg, #ff3131, #ff5f5f)', color: 'white' }}>✕ SƏHV KART</button>
                        </div>
                    </div>

                    <div className="glass" style={{ padding: '2.5rem', borderRadius: '32px' }}>
                        <h3 style={{ marginBottom: '2rem', color: 'var(--primary)', fontSize: '1.4rem' }}>👥 İdarəetmə</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <button className="btn" onClick={() => { setShowAddStudent(true); setNfcMode('add'); }} style={{ padding: '1.5rem', borderRadius: '20px', justifyContent: 'flex-start', background: 'rgba(0, 243, 255, 0.05)', border: '1px solid var(--primary)', color: 'white' }}>➕ Yeni Tələbə Əlavə Et</button>
                            <button className="btn" onClick={() => { setShowDeleteStudent(true); setNfcMode('delete'); }} style={{ padding: '1.5rem', borderRadius: '20px', justifyContent: 'flex-start', background: 'rgba(255, 49, 49, 0.05)', border: '1px solid var(--error)', color: 'white' }}>🗑️ Tələbəni Sistemdən Sil</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ATTENDANCE & SETTINGS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2.5rem', marginTop: '3rem', marginBottom: '4rem' }}>

                {/* DAILY ATTENDANCE LIST */}
                <div className="glass" style={{ padding: '2rem', borderRadius: '32px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>📅</span>
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0 }}>Gündəlik Yoxlama</h3>
                        </div>
                        <input
                            type="date"
                            className="input-field"
                            style={{ width: 'auto', padding: '0.6rem 1rem', fontSize: '0.9rem' }}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>

                    <div style={{ flex: 1, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', opacity: 0.6, fontSize: '0.85rem' }}>
                                    <th style={{ padding: '1rem' }}>Tələbə</th>
                                    <th style={{ padding: '1rem' }}>Status</th>
                                    <th style={{ padding: '1rem' }}>Saat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyAttendance.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" style={{ padding: '3rem', textAlign: 'center', opacity: 0.4 }}>
                                            {new Date().toTimeString().slice(0, 5) < lessonStartTime ?
                                                '⏳ Dərs Gözlənilir...' :
                                                'Məlumat tapılmadı.'}
                                        </td>
                                    </tr>
                                ) : (
                                    dailyAttendance.map((record, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 500 }}>{record.studentName || record.studentId?.name}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{record.courseGroup || '-'}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    padding: '0.3rem 0.8rem',
                                                    borderRadius: '10px',
                                                    fontSize: '0.8rem',
                                                    background: record.status === 'present' ? 'rgba(57, 255, 20, 0.1)' :
                                                        record.status === 'late' ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255, 49, 49, 0.1)',
                                                    color: record.status === 'present' ? 'var(--success)' :
                                                        record.status === 'late' ? 'orange' : 'var(--error)',
                                                    fontWeight: 600
                                                }}>
                                                    {record.status === 'present' ? 'Dərsdə' :
                                                        record.status === 'late' ? 'Gecikib' : 'Qayıb'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', opacity: 0.9, fontSize: '0.9rem' }}>
                                                {record.time || '--:--'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* LESSON SETTINGS PANEL - REDESIGNED */}
                <div className="glass" style={{ padding: '2.5rem', borderRadius: '32px', height: 'fit-content', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                        <div style={{ width: '50px', height: '50px', background: 'rgba(0, 243, 255, 0.1)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>⚙️</div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600 }}>Dərs Saatları</h3>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.2rem' }}>Sistem timer ayarları</div>
                        </div>
                        {isCustomSchedule ? (
                            <div style={{ padding: '0.3rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, background: 'var(--primary)', color: 'black' }}>XÜSUSİ</div>
                        ) : (
                            <div style={{ padding: '0.3rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.2)', opacity: 0.6 }}>STANDART</div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Custom Date Selector */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--primary)' }}>
                                📅 Məqsəd Tarix
                            </label>
                            <input
                                type="date"
                                className="input-field"
                                style={{ background: 'rgba(0,0,0,0.2)' }}
                                value={settingsDate}
                                onChange={(e) => setSettingsDate(e.target.value)}
                            />
                            <div style={{ fontSize: '0.75rem', marginTop: '0.6rem', opacity: 0.5 }}>Boş buraxdıqda hər gün üçün keçərli olur.</div>
                        </div>

                        {/* Time Range Selector */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', fontSize: '0.85rem', fontWeight: 500, color: '#10b981' }}>
                                    🕒 Başlama
                                </label>
                                <input
                                    type="time"
                                    className="input-field"
                                    style={{ background: 'rgba(0,0,0,0.2)', fontSize: '1.1rem', fontWeight: 600 }}
                                    value={lessonStartTime}
                                    onChange={(e) => setLessonStartTime(e.target.value)}
                                />
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', fontSize: '0.85rem', fontWeight: 500, color: '#ff5f5f' }}>
                                    🕒 Bitmə
                                </label>
                                <input
                                    type="time"
                                    className="input-field"
                                    style={{ background: 'rgba(0,0,0,0.2)', fontSize: '1.1rem', fontWeight: 600 }}
                                    value={lessonEndTime}
                                    onChange={(e) => setLessonEndTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <button className="btn" onClick={handleSaveSettings} style={{
                            width: '100%',
                            padding: '1.2rem',
                            borderRadius: '20px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            letterSpacing: '1px',
                            boxShadow: '0 10px 20px rgba(0, 243, 255, 0.15)',
                            marginTop: '0.5rem'
                        }}>
                            💾 PARAMETRLƏRİ YADDA SAXLA
                        </button>
                    </div>

                    <div style={{ marginTop: '2.5rem', padding: '1.2rem', background: 'rgba(255, 243, 0, 0.05)', borderRadius: '20px', border: '1px solid rgba(255, 243, 0, 0.1)', display: 'flex', gap: '1rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, lineHeight: '1.4' }}>
                            Sistem hər gün səhər saat <b>{lessonStartTime}</b>-dan sonra gəlməyənləri avtomatik qeyd edir.
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS - FIXED CENTERED */}
            {showAddStudent && (
                <div className="modal-backdrop" onClick={() => setShowAddStudent(false)}
                    style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass"
                        style={{
                            width: '500px',
                            padding: '3rem',
                            background: 'var(--bg-dark)',
                            border: '1px solid var(--primary)',
                            boxShadow: '0 0 50px rgba(0, 243, 255, 0.2)',
                            position: 'relative' // Centered by backdrop flex
                        }}
                        onClick={e => e.stopPropagation()}>

                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>➕ Yeni Tələbə</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <input className="input-field" placeholder="Ad Soyad" value={studentName} onChange={e => setStudentName(e.target.value)} />
                            <input className="input-field" placeholder="Kurs / Qrup" value={courseGroup} onChange={e => setCourseGroup(e.target.value)} />
                            <input className="input-field" placeholder="İstifadəçi Adı" value={username} onChange={e => setUsername(e.target.value)} />
                            <input className="input-field" type="password" placeholder="Şifrə" value={password} onChange={e => setPassword(e.target.value)} />

                            {/* DYNAMIC NFC BUTTON */}
                            <button
                                className={`btn ${isReadingNfc ? 'nfc-reading' : ''}`}
                                onClick={startNfcRead}
                                style={{
                                    height: '55px',
                                    background: isReadingNfc ? 'linear-gradient(90deg, #ff9800, #f57c00)' : 'var(--primary)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                {isReadingNfc ? '🛑 DURDUR' : '📡 NFC Oxut'}
                            </button>

                            {nfcUid && <div style={{ color: 'var(--success)', textAlign: 'center', fontWeight: 'bold', padding: '1rem', background: 'rgba(57, 255, 20, 0.1)', borderRadius: '12px', border: '1px solid rgba(57, 255, 20, 0.2)' }}>✅ Kart Oxundu: {nfcUid}</div>}

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button className="btn" style={{ flex: 1 }} onClick={handleSaveStudent} disabled={!studentName || !nfcUid}>Yadda Saxla</button>
                                <button className="btn cancel" style={{ flex: 1 }} onClick={() => setShowAddStudent(false)}>Ləğv et</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteStudent && (
                <div className="modal-backdrop" onClick={() => setShowDeleteStudent(false)}
                    style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass"
                        style={{
                            width: '500px',
                            padding: '3rem',
                            background: 'var(--bg-dark)',
                            border: '1px solid var(--error)',
                            boxShadow: '0 0 50px rgba(255, 49, 49, 0.2)',
                            position: 'relative'
                        }}
                        onClick={e => e.stopPropagation()}>

                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>🗑️ Tələbə Sil</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Silmək istədiyiniz tələbənin NFC kartını oxudun.</p>

                            {/* DYNAMIC NFC BUTTON */}
                            <button
                                className={`btn ${isReadingNfc ? 'nfc-reading' : ''}`}
                                style={{
                                    background: isReadingNfc ? 'linear-gradient(90deg, #ff9800, #f57c00)' : 'var(--error)',
                                    height: '55px',
                                    transition: 'all 0.3s ease'
                                }}
                                onClick={startNfcRead}
                            >
                                {isReadingNfc ? '🛑 DURDUR' : '📡 NFC Oxut'}
                            </button>

                            {nfcUid && <div style={{ color: 'var(--error)', textAlign: 'center', fontWeight: 'bold', padding: '1rem', background: 'rgba(255, 49, 49, 0.1)', borderRadius: '12px', border: '1px solid rgba(255, 49, 49, 0.2)' }}>✅ Kart Oxundu: {nfcUid}</div>}

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button className="btn" style={{ flex: 1, background: 'var(--error)' }} onClick={handleDeleteStudent} disabled={!nfcUid}>Təsdiqlə və Sil</button>
                                <button className="btn cancel" style={{ flex: 1 }} onClick={() => setShowDeleteStudent(false)}>Ləğv et</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
