import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const [scanHistory, setScanHistory] = useState([]);
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    useEffect(() => {
        // İlk yükleme
        fetchHistory();

        // Polling mechanism to check for new scans every 2 seconds
        const interval = setInterval(() => {
            fetchHistory();
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/scan-history');
            if (Array.isArray(res.data)) {
                setScanHistory(res.data);
            }
        } catch (err) {
            console.error("Data gəlmədi", err);
        }
    };

    const handleSimulation = async (nfcData) => {
        try {
            await axios.post('http://localhost:5000/api/check-nfc', { nfcData });
            // Hemen güncelle
            fetchHistory();
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.message || error.message || "Bilinmeyen xəta";
            alert(`Simulyasiya xətası: ${errorMsg}`);
        }
    };

    return (
        <div className="container animate-fade-in">
            <nav className="nav glass" style={{ padding: '1rem 2rem' }}>
                <div className="logo">NFC Yoklama</div>
                <button onClick={handleLogout} className="btn" style={{ background: 'transparent', border: '1px solid var(--text-muted)' }}>
                    Çıxış
                </button>
            </nav>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>

                <div className="glass status-card" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <h2 style={{ color: 'var(--text-muted)', marginBottom: '1rem', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', padding: '10px', zIndex: 10, borderRadius: '8px' }}>
                        Son Oxunan Kartlar (Giriş Keçmişi)
                    </h2>

                    {scanHistory.length === 0 ? (
                        <div style={{ padding: '2rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                            Hələ kart oxudulmadı...
                        </div>
                    ) : (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {scanHistory.map((scan, index) => (
                                <div key={index} className="glass" style={{
                                    padding: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    borderLeft: `5px solid ${scan.found ? 'var(--primary)' : 'var(--error)'}`,
                                    background: 'rgba(255, 255, 255, 0.03)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ fontSize: '1.5rem' }}>
                                            {scan.found ? '✅' : '❌'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                                {scan.message}
                                            </div>
                                            {scan.timestamp && (
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    {new Date(scan.timestamp).toLocaleTimeString()} - {new Date(scan.timestamp).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Simülasyon Paneli - Test amaçlı */}
                <div className="glass" style={{ padding: '2rem', marginTop: '2rem', opacity: 0.8 }}>
                    <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>🛠 Simulyasiya</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>GSM Modulunu simulyasiya etmək üçün aşağıdakı butonları istifadə edə bilərsiniz.</p>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            className="btn"
                            onClick={() => handleSimulation("0x00 0x00")}
                        >
                            Düzgün Kart Oxut (Elxan)
                        </button>
                        <button
                            className="btn"
                            style={{ background: 'var(--error)' }}
                            onClick={() => handleSimulation("0x99 0x99")}
                        >
                            Səhv Kart Oxut (Bilinmeyen)
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
