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

    // ✅ Backend uyumlu NFC okuma:
    // 1) Mode başlat: /api/nfc/start-wait veya /api/nfc/start-delete
    // 2) /api/nfc/latest polling (1s)
    const startNfcRead = async () => {
        setIsReadingNfc(true);
        setNfcUid('');

        try {
            if (nfcMode === 'add') {
                await axios.post('/api/nfc/start-wait');
            } else if (nfcMode === 'delete') {
                await axios.post('/api/nfc/start-delete');
            } else {
                // mode set edilmemişse güvenli fallback
                await axios.post('/api/nfc/start-wait');
            }

            const startedAt = Date.now();
            const interval = setInterval(async () => {
                try {
                    const res = await axios.get('/api/nfc/latest');
                    const uid = res.data?.uid;

                    if (uid) {
                        setNfcUid(uid);
                        setIsReadingNfc(false);
                        clearInterval(interval);
                    }

                    // 10 saniye timeout
                    if (Date.now() - startedAt > 10000) {
                        setIsReadingNfc(false);
                        clearInterval(interval);
                    }
                } catch (e) {
                    setIsReadingNfc(false);
                    clearInterval(interval);
                }
            }, 1000);

        } catch (err) {
            console.error('NFC setup error:', err);
            setIsReadingNfc(false);
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

            {/* NEW ROW: ATTENDANCE & SETTINGS */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '3rem' }}>

                {/* DAILY ATTENDANCE LIST */}
                <div className="glass" style={{ padding: '2.5rem', borderRadius: '32px', minHeight: '500px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.6rem', margin: 0 }}>📅 Gündəlik Yoxlama</h3>
                        <input
                            type="date"
                            className="input-field"
                            style={{ width: 'auto' }}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem' }}>Tələbə</th>
                                    <th style={{ padding: '1rem' }}>Qrup</th>
                                    <th style={{ padding: '1rem' }}>Status</th>
                                    <th style={{ padding: '1rem' }}>Saat</th>
                                    <th style={{ padding: '1rem' }}>Qeyd</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyAttendance.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                            {/* Check if it's before lesson start to show "Waiting" */}
                                            {new Date().toTimeString().slice(0, 5) < lessonStartTime ?
                                                '⏳ Dərs Gözlənilir...' :
                                                'Bu tarix üçün məlumat yoxdur.'}
                                        </td>
                                    </tr>
                                ) : (
                                    dailyAttendance.map((record, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '1rem' }}>{record.studentName || record.studentId?.name}</td>
                                            <td style={{ padding: '1rem' }}>{record.courseGroup || '-'}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    padding: '0.4rem 1rem',
                                                    borderRadius: '12px',
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
                                            <td style={{ padding: '1rem', opacity: 0.9, fontWeight: 500 }}>
                                                {record.time || '-'}
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.8rem', opacity: 0.7 }}>
                                                {record.autoMarked ? '🤖 Avto' : '👤 Manual'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SETTINGS PANEL */}
                <div className="glass" style={{ padding: '2.5rem', borderRadius: '32px', height: 'fit-content' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h3 style={{ color: 'var(--primary)', fontSize: '1.4rem', margin: 0 }}>⚙️ Dərs Saatları</h3>
                        {/* Status Badge */}
                        <div style={{
                            padding: '0.3rem 0.8rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            background: isCustomSchedule ? 'rgba(0, 243, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                            color: isCustomSchedule ? 'var(--primary)' : 'var(--text-muted)',
                            border: isCustomSchedule ? '1px solid currentColor' : 'none'
                        }}>
                            {isCustomSchedule ? 'Xüsusi (Bu Tarix)' : 'Standart (Hər Gün)'}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Date Picker */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Tarix Seç (Standart üçün boş burax)</label>
                            <input
                                type="date"
                                className="input-field"
                                value={settingsDate}
                                onChange={(e) => setSettingsDate(e.target.value)}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Dərs Başlama Saatı</label>
                            <input
                                type="time"
                                className="input-field"
                                value={lessonStartTime}
                                onChange={(e) => setLessonStartTime(e.target.value)}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Dərs Bitmə Saatı</label>
                            <input
                                type="time"
                                className="input-field"
                                value={lessonEndTime}
                                onChange={(e) => setLessonEndTime(e.target.value)}
                            />
                        </div>

                        <button className="btn" onClick={handleSaveSettings} style={{ marginTop: '1rem' }}>
                            💾 Yadda Saxla
                        </button>
                    </div>

                    <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', fontSize: '0.9rem', opacity: 0.8 }}>
                        ℹ️ Sistem avtomatik olaraq hər gün <b>{lessonStartTime}</b>-dan sonra dərsə gəlməyənləri "Qayıb" yazacaq.
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {showAddStudent && (
                <div className="modal-backdrop" onClick={() => setShowAddStudent(false)}>
                    <div className="glass" style={{ width: '500px', padding: '3rem', background: 'var(--bg-dark)', border: '1px solid var(--primary)' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>➕ Yeni Tələbə</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <input className="input-field" placeholder="Ad Soyad" value={studentName} onChange={e => setStudentName(e.target.value)} />
                            <input className="input-field" placeholder="Kurs / Qrup" value={courseGroup} onChange={e => setCourseGroup(e.target.value)} />
                            <input className="input-field" placeholder="İstifadəçi Adı" value={username} onChange={e => setUsername(e.target.value)} />
                            <input className="input-field" type="password" placeholder="Şifrə" value={password} onChange={e => setPassword(e.target.value)} />
                            <button className={`btn ${isReadingNfc ? 'nfc-reading' : ''}`} onClick={startNfcRead} style={{ height: '55px' }}>{isReadingNfc ? '📡 NFC Gözlənilir...' : '📡 NFC Oxut'}</button>
                            {nfcUid && <div style={{ color: 'var(--success)', textAlign: 'center', fontWeight: 'bold', padding: '1rem', background: 'rgba(57, 255, 20, 0.1)', borderRadius: '12px' }}>✅ Oxunan UID: {nfcUid}</div>}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button className="btn" style={{ flex: 1 }} onClick={handleSaveStudent} disabled={!studentName || !nfcUid}>Yadda Saxla</button>
                                <button className="btn cancel" style={{ flex: 1 }} onClick={() => setShowAddStudent(false)}>Ləğv et</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteStudent && (
                <div className="modal-backdrop" onClick={() => setShowDeleteStudent(false)}>
                    <div className="glass" style={{ width: '500px', padding: '3rem', background: 'var(--bg-dark)', border: '1px solid var(--error)' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>🗑️ Tələbə Sil</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <p style={{ color: 'var(--text-muted)' }}>Silmək istədiyiniz tələbənin NFC kartını oxudun.</p>
                            <button className={`btn ${isReadingNfc ? 'nfc-reading' : ''}`} style={{ background: 'var(--error)', height: '55px' }} onClick={startNfcRead}>{isReadingNfc ? '📡 NFC Gözlənilir...' : '📡 NFC Oxut'}</button>
                            {nfcUid && <div style={{ color: 'var(--error)', textAlign: 'center', fontWeight: 'bold', padding: '1rem', background: 'rgba(255, 49, 49, 0.1)', borderRadius: '12px' }}>✅ Oxunan UID: {nfcUid}</div>}
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
