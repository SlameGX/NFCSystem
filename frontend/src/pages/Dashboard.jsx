import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

/* INPUT STYLE */
const inputStyle = {
    width: '100%',
    padding: '0.7rem',
    borderRadius: '12px',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box'
};

const Dashboard = () => {
    const [scanHistory, setScanHistory] = useState([]);

    // ADD STUDENT
    const [showAddStudent, setShowAddStudent] = useState(false);
    const [studentName, setStudentName] = useState('');
    const [nfcUid, setNfcUid] = useState('');
    const [isReadingNfc, setIsReadingNfc] = useState(false);

    // DELETE STUDENT
    const [showDeleteStudent, setShowDeleteStudent] = useState(false);
    const [isDeletingNfc, setIsDeletingNfc] = useState(false);
    const [deleteUid, setDeleteUid] = useState(null);
    const deleteIntervalRef = useRef(null);

    const navigate = useNavigate();

    /* LOGOUT */
    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    /* HISTORY */
    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 2000);
        return () => clearInterval(interval);
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get('/api/scan-history');
            if (Array.isArray(res.data)) setScanHistory(res.data);
        } catch {}
    };

    /* SIMULATION */
    const handleSimulation = async (nfcData) => {
        await axios.post('/api/check-nfc', { nfcData });
        fetchHistory();
    };

    /* ADD NFC READ */
    const handleReadNfc = async () => {
        if (isReadingNfc) return;

        setIsReadingNfc(true);
        setNfcUid('');

        await axios.post('/api/nfc/start-wait');

        const interval = setInterval(async () => {
            const res = await axios.get('/api/nfc/latest');
            if (res.data.uid) {
                setNfcUid(res.data.uid);
                setIsReadingNfc(false);
                clearInterval(interval);
            }
        }, 1000);
    };

    /* SAVE STUDENT */
    const handleSaveStudent = async () => {
        if (!studentName || !nfcUid) return;

        await axios.post('/api/students', {
            name: studentName,
            nfcUid
        });

        setStudentName('');
        setNfcUid('');
        setShowAddStudent(false);
    };

    /* DELETE NFC READ */
    const handleDeleteReadNfc = async () => {
        if (isDeletingNfc) {
            clearInterval(deleteIntervalRef.current);
            deleteIntervalRef.current = null;
            setIsDeletingNfc(false);
            return;
        }

        setIsDeletingNfc(true);
        setDeleteUid(null);

        await axios.post('/api/nfc/start-delete');

        deleteIntervalRef.current = setInterval(async () => {
            const res = await axios.get('/api/nfc/latest');
            if (res.data.uid) {
                setDeleteUid(res.data.uid);
                setIsDeletingNfc(false);
                clearInterval(deleteIntervalRef.current);
                deleteIntervalRef.current = null;
            }
        }, 1000);
    };

    /* CONFIRM DELETE */
    const handleConfirmDelete = async () => {
        if (!deleteUid) return;

        await axios.post('/api/check-nfc', {
            nfcData: deleteUid
        });

        setDeleteUid(null);
        setShowDeleteStudent(false);
        fetchHistory();
    };

    return (
        <div className="container animate-fade-in">

            {/* NAVBAR */}
            <nav className="nav glass" style={{ padding: '1rem 2rem' }}>
                <div className="logo">NFC İlə Tələbə Sistemi</div>
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
                    <h2 className="sticky-title">Son Oxunan Kartlar</h2>

                    {scanHistory.length === 0 ? (
                        <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
                            Hələ kart oxudulmadı...
                        </div>
                    ) : (
                        <div className="history-list">
                            {scanHistory.map((scan, index) => (
                                <div
                                    key={index}
                                    className="glass history-item"
                                    style={{
                                        borderLeft: `5px solid ${scan.found ? 'var(--primary)' : 'var(--error)'}`
                                    }}
                                >
                                    <div className="history-icon">
                                        {scan.found ? '✅' : '❌'}
                                    </div>
                                    <div>
                                        <div className="history-text">{scan.message}</div>
                                        <div className="history-time">
                                            {new Date(scan.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ALT PANEL */}
                <div className="bottom-panels">

                    {/* SIMULATION */}
                    <div className="glass panel">
                        <h3>🛠 Simulyasiya</h3>
                        <div className="panel-actions">
                            <button className="btn" onClick={() => handleSimulation('0x00 0x00')}>
                                ✅ Düzgün Kart
                            </button>
                            <button
                                className="btn"
                                style={{ background: 'var(--error)' }}
                                onClick={() => handleSimulation('0x99 0x99')}
                            >
                                ❌ Səhv Kart
                            </button>
                        </div>
                    </div>

                    {/* SPLIT PANEL */}
                    <div
                        className="glass panel center"
                        style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch' }}
                    >

                        {/* LEFT */}
                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}
                        >
                            <div>
                                <div className="big-plus">➕</div>
                                <h4>Yeni Tələbə</h4>
                            </div>

                            <div style={{ flex: 1 }} />

                            <button
                                className="btn full"
                                onClick={() => setShowAddStudent(true)}
                            >
                                Əlavə et
                            </button>
                        </div>

                        {/* DIVIDER */}
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />

                        {/* RIGHT */}
                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '2.2rem' }}>🗑️</div>
                                <h4>Tələbə Sil</h4>
                            </div>

                            <div style={{ flex: 1 }} />

                            <button
                                className="btn full"
                                style={{ background: 'var(--error)' }}
                                onClick={() => setShowDeleteStudent(true)}
                            >
                                Sil
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ADD MODAL */}
            {showAddStudent && (
                <div className="modal-backdrop" onClick={() => setShowAddStudent(false)}>
                    <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                        <h3>➕ Yeni Tələbə</h3>
                        <p className="modal-desc">Ad yaz və NFC kartını oxut</p>

                        <div className="modal-body">
                            <input
                                placeholder="Ad Soyad"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                style={inputStyle}
                            />

                            <button
                                className={`btn full ${isReadingNfc ? 'nfc-reading' : ''}`}
                                onClick={handleReadNfc}
                                disabled={isReadingNfc}
                            >
                                {isReadingNfc ? '📡 NFC gözlənilir...' : '📡 NFC Kart Oxut'}
                            </button>

                            {nfcUid && (
                                <div className="uid-box">
                                    ✅ Oxunan UID: <b>{nfcUid}</b>
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    className="btn"
                                    disabled={!studentName || !nfcUid}
                                    onClick={handleSaveStudent}
                                >
                                    💾 Qeyd et
                                </button>
                                <button
                                    className="btn cancel"
                                    onClick={() => setShowAddStudent(false)}
                                >
                                    Ləğv et
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {showDeleteStudent && (
                <div className="modal-backdrop" onClick={() => setShowDeleteStudent(false)}>
                    <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                        <h3>🗑️ Tələbə Sil</h3>
                        <p className="modal-desc">NFC kartını oxut</p>

                        <div className="modal-body">
                            <button
                                className={`btn full ${isDeletingNfc ? 'nfc-reading' : ''}`}
                                style={{ background: 'var(--error)' }}
                                onClick={handleDeleteReadNfc}
                            >
                                {isDeletingNfc ? '⏹️ Dayandır' : '📡 NFC Kart Oxut'}
                            </button>

                            {deleteUid && (
                                <div className="uid-box">
                                    🆔 Oxunan UID: <b>{deleteUid}</b>
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    className="btn danger"
                                    disabled={!deleteUid}
                                    onClick={handleConfirmDelete}
                                >
                                    🗑️ Kaydet
                                </button>
                                <button
                                    className="btn cancel"
                                    onClick={() => {
                                        if (deleteIntervalRef.current) {
                                            clearInterval(deleteIntervalRef.current);
                                            deleteIntervalRef.current = null;
                                        }
                                        setDeleteUid(null);
                                        setIsDeletingNfc(false);
                                        setShowDeleteStudent(false);
                                    }}
                                >
                                    Ləğv et
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Dashboard;
