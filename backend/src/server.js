import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/* INPUT STYLE */
const inputStyle = {
    width: '100%',
    padding: '0.7rem',
    marginTop: '0.8rem',
    borderRadius: '8px',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    outline: 'none'
};

const Dashboard = () => {
    const [scanHistory, setScanHistory] = useState([]);

    // MODAL & FORM
    const [showAddStudent, setShowAddStudent] = useState(false);
    const [studentName, setStudentName] = useState('');
    const [nfcUid, setNfcUid] = useState('');
    const [isReadingNfc, setIsReadingNfc] = useState(false);

    const navigate = useNavigate();

    /* LOGOUT */
    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    /* HISTORY POLLING */
    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 2000);
        return () => clearInterval(interval);
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get('/api/scan-history');
            if (Array.isArray(res.data)) {
                setScanHistory(res.data);
            }
        } catch (err) {
            console.error("History alınamadı", err);
        }
    };

    /* NORMAL NFC SIMULATION (YOKLAMA) */
    const handleSimulation = async (nfcData) => {
        try {
            await axios.post('/api/check-nfc', { nfcData });
            fetchHistory();
        } catch (err) {
            alert('Simulyasiya xətası');
        }
    };

    /* ================= NFC OKUT (BACKEND BEKLEME MODU) ================= */
    const handleReadNfc = async () => {
        setIsReadingNfc(true);
        setNfcUid('');

        try {
            // 1️⃣ Backend'e "bekle" de
            await axios.post('/api/nfc/start-wait');

            // 2️⃣ UID gelene kadar polling
            const interval = setInterval(async () => {
                const res = await axios.get('/api/nfc/latest');

                if (res.data.uid) {
                    setNfcUid(res.data.uid);
                    setIsReadingNfc(false);
                    clearInterval(interval);
                }
            }, 1000);

        } catch (err) {
            setIsReadingNfc(false);
            alert('NFC oxuma başlatılamadı');
        }
    };

    /* ================= SAVE STUDENT ================= */
    const handleSaveStudent = async () => {
        if (!studentName || !nfcUid) return;

        try {
            await axios.post('/api/students', {
                name: studentName,
                nfcUid
            });

            // RESET
            setStudentName('');
            setNfcUid('');
            setShowAddStudent(false);

        } catch (err) {
            alert(err.response?.data?.message || 'Kayıt xətası');
        }
    };

    return (
        <div className="container animate-fade-in">

            {/* NAVBAR */}
            <nav className="nav glass" style={{ padding: '1rem 2rem' }}>
                <div className="logo">NFC Yoklama</div>
                <button
                    onClick={handleLogout}
                    className="btn"
                    style={{ background: 'transparent', border: '1px solid var(--text-muted)' }}
                >
                    Çıxış
                </button>
            </nav>

            <div style={{ display: 'grid', gap: '2rem' }}>

                {/* HISTORY */}
                <div className="glass status-card" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <h2 style={{
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                        position: 'sticky',
                        top: 0,
                        background: 'rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(10px)',
                        padding: '10px',
                        zIndex: 10,
                        borderRadius: '8px'
                    }}>
                        Son Oxunan Kartlar
                    </h2>

                    {scanHistory.length === 0 ? (
                        <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
                            Hələ kart oxudulmadı...
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {scanHistory.map((scan, index) => (
                                <div
                                    key={index}
                                    className="glass"
                                    style={{
                                        padding: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        borderLeft: `5px solid ${scan.found ? 'var(--primary)' : 'var(--error)'}`,
                                        background: 'rgba(255,255,255,0.03)'
                                    }}
                                >
                                    <div style={{ fontSize: '1.5rem', marginRight: '1rem' }}>
                                        {scan.found ? '✅' : '❌'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{scan.message}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {new Date(scan.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ALT PANEL */}
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

                    {/* SIMULATION */}
                    <div className="glass" style={{ flex: '1 1 65%', padding: '2rem' }}>
                        <h3>🛠 Simulyasiya</h3>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button className="btn" style={{ flex: 1 }} onClick={() => handleSimulation("0x00 0x00")}>
                                ✅ Düzgün Kart
                            </button>
                            <button
                                className="btn"
                                style={{ flex: 1, background: 'var(--error)' }}
                                onClick={() => handleSimulation("0x99 0x99")}
                            >
                                ❌ Səhv Kart
                            </button>
                        </div>
                    </div>

                    {/* ADD STUDENT */}
                    <div className="glass" style={{ flex: '1 1 30%', padding: '2rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem' }}>➕</div>
                        <h4>Yeni Öğrenci</h4>
                        <button className="btn" style={{ width: '100%' }} onClick={() => setShowAddStudent(true)}>
                            Öğrenci Ekle
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL */}
            {showAddStudent && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(6px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999
                    }}
                    onClick={() => setShowAddStudent(false)}
                >
                    <div
                        className="glass"
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '380px', padding: '2rem', borderRadius: '16px' }}
                    >
                        <h3>➕ Yeni Öğrenci</h3>

                        <input
                            placeholder="Ad Soyad"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            style={inputStyle}
                        />

                        <button
                            className="btn"
                            style={{ width: '100%', marginTop: '1rem' }}
                            onClick={handleReadNfc}
                            disabled={isReadingNfc}
                        >
                            {isReadingNfc ? 'NFC gözlənilir...' : '📡 NFC Kart Okut'}
                        </button>

                        {nfcUid && (
                            <div style={{ marginTop: '0.8rem', color: 'var(--primary)' }}>
                                Oxunan UID: {nfcUid}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                            <button
                                className="btn"
                                style={{ flex: 1 }}
                                disabled={!studentName || !nfcUid}
                                onClick={handleSaveStudent}
                            >
                                Kaydet
                            </button>
                            <button
                                className="btn"
                                style={{ flex: 1, background: 'var(--error)' }}
                                onClick={() => setShowAddStudent(false)}
                            >
                                İptal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
