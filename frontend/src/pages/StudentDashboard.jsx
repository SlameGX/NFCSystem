import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const StudentDashboard = () => {
    const [user, setUser] = useState({
        name: "Yüklənir...",
        username: "...",
        nfcUid: "..."
    });
    const [history, setHistory] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('studentUser');
        const token = localStorage.getItem('studentToken');

        if (storedUser && token) {
            try {
                setUser(JSON.parse(storedUser));
                fetchData(token);
                const interval = setInterval(() => fetchData(token), 3000);
                return () => clearInterval(interval);
            } catch (e) {
                console.error('Data error:', e);
            }
        } else {
            // Dizaynı görmək üçün yönləndirməni söndürürük və mock data ilə davam edirik
            setUser({
                name: "Nümunə Tələbə",
                username: "telebe01",
                nfcUid: "0x4A 0xB2 0xC9 0xD1"
            });
        }
    }, [navigate]);

    const fetchData = async (token) => {
        try {
            // 1. Profile
            const res = await axios.get('/api/student/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            // 2. Attendance History
            const resHistory = await axios.get('/api/attendance/my-history', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const newHistory = resHistory.data || [];

            // Simple check for new scan (if count increases)
            if (newHistory.length > history.length && history.length > 0) {
                setIsScanning(true);
                setTimeout(() => setIsScanning(false), 3000);
            }
            setHistory(newHistory);
        } catch (err) {
            if (err.response?.status === 401) {
                localStorage.clear();
                navigate('/login');
            }
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="container animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            {/* ... NAVBAR & STATUS (unchanged) ... */}
            {/* NAVBAR */}
            <nav className="nav glass" style={{ padding: '1.2rem 2.5rem', borderRadius: '20px', marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="logo" style={{ fontSize: '1.8rem', fontWeight: 800 }}>EduPass</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div className="neon-text-primary" style={{ fontWeight: 600, fontSize: '1rem' }}>{user.name}</div>
                    <button onClick={handleLogout} className="btn" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', fontSize: '0.8rem' }}>Çıxış</button>
                </div>
            </nav>

            {/* BIG STATUS DISPLAY */}
            <div className={`glass ${isScanning ? 'nfc-reading' : ''}`} style={{
                padding: '4rem 2rem',
                textAlign: 'center',
                borderRadius: '40px',
                marginBottom: '3rem',
                background: isScanning ? 'rgba(0, 243, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {isScanning && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--primary)', boxShadow: '0 0 20px var(--primary)' }} />}

                <div style={{ fontSize: '1rem', color: 'var(--text-muted)', letterSpacing: '4px', marginBottom: '1.5rem', fontWeight: 500 }}>SİSTEM AKTİVDİR</div>

                <h1 style={{
                    fontSize: '4.5rem',
                    margin: '0 0 1rem 0',
                    fontWeight: 800,
                    textShadow: isScanning ? '0 0 30px var(--primary)' : '0 0 10px rgba(255,255,255,0.2)',
                    color: isScanning ? 'var(--primary)' : 'white',
                    transition: 'all 0.5s ease'
                }}>
                    {isScanning ? user.name : "Xoş Gəldiniz!"}
                </h1>

                <p style={{ fontSize: '1.2rem', color: isScanning ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 400 }}>
                    {isScanning ? "Girişiniz uğurla qeydə alındı ⚡" : "Davamiyyəti yoxlamaq üçün kartınızı oxudun"}
                </p>

                <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center', gap: '3rem' }}>
                    <div className="glass" style={{ padding: '1rem 2.5rem', borderRadius: '20px', border: '1px solid rgba(0, 243, 255, 0.1)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', opacity: 0.7, marginBottom: '0.3rem' }}>CARD ID</div>
                        <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1.1rem' }}>{user.nfcUid}</div>
                    </div>
                </div>
            </div>

            {/* DETAILS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                {/* RECENT ACTIVITY PANEL */}
                <div className="glass" style={{ padding: '2.5rem', borderRadius: '32px', height: '500px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Giriş Tarixçəsi</h3>
                        <div className="neon-text-success" style={{ fontSize: '0.85rem', fontWeight: 700 }}>CANLI 📡</div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                        {history.length === 0 ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, fontSize: '1rem' }}>Heç bir qeyd yoxdur</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {[...history].map((scan, index) => (
                                    <div key={index} className="glass" style={{
                                        padding: '1.2rem',
                                        borderRadius: '18px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1.5rem',
                                        background: scan.status === 'present' ? 'rgba(57, 255, 20, 0.02)' :
                                            scan.status === 'late' ? 'rgba(255, 165, 0, 0.02)' : 'rgba(255, 49, 49, 0.02)',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '12px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: scan.status === 'present' ? 'rgba(57, 255, 20, 0.1)' :
                                                scan.status === 'late' ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255, 49, 49, 0.1)',
                                            color: scan.status === 'present' ? 'var(--success)' :
                                                scan.status === 'late' ? 'orange' : 'var(--error)',
                                            fontSize: '1rem'
                                        }}>{scan.status === 'present' ? '✓' : scan.status === 'late' ? '⚠️' : '✕'}</div>

                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                                {scan.status === 'present' ? 'Dərsdə' : scan.status === 'late' ? 'Gecikib' : 'Qayıb'}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{scan.date}</div>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                            {scan.scanTime ? new Date(scan.scanTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* PROFILE & QUICK STATS */}
                <div className="glass" style={{ padding: '2.5rem', borderRadius: '32px' }}>
                    <h3 style={{ marginBottom: '2rem', fontSize: '1.4rem' }}>Mənim Profilim</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', background: 'rgba(0, 243, 255, 0.02)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '0.4rem', letterSpacing: '1px' }}>İSTİFADƏÇİ ADI</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{user.username}</div>
                        </div>

                        <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.02)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '1px' }}>KURS / QRUP</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{user.courseGroup || '-'}</div>
                        </div>

                        <div style={{ marginTop: '1rem', padding: '1.5rem', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(0, 243, 255, 0.1), rgba(255, 0, 255, 0.1))', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>BU AYKI AKTİVLİK</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)' }}>94%</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Əla göstərici! ⚡</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StudentDashboard;
