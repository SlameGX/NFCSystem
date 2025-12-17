require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Student = require('./models/Student');

const app = express();
const PORT = 5000;

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= DB ================= */
mongoose.connect(
    'mongodb://nfcuser:StrongPassword123@127.0.0.1:27017/nfcAttendanceDB?authSource=nfcAttendanceDB'
).then(() => {
    console.log('✅ MongoDB connected');
}).catch(err => {
    console.error('❌ MongoDB error:', err.message);
});

/* ================= LOGIN ================= */
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'elxan' && password === '1234') {
        return res.json({ success: true });
    }
    res.status(401).json({ success: false });
});

/* ================= NFC STATE ================= */
let scanHistory = [];
let waitingForNfc = false;
let lastNfcUid = null;

/* ================= DEBUG ================= */
app.post('/api/_debug/post-test', (req, res) => {
    res.json({ ok: true, body: req.body });
});

/* ================= NFC START (Öğrenci ekleme için bekleme) ================= */
app.post('/api/nfc/start-wait', (req, res) => {
    waitingForNfc = true;
    lastNfcUid = null;
    console.log('📡 NFC Gözləmə modu aktiv');
    res.json({ success: true });
});

/* ================= NFC CHECK (SIM868 buraya vurur) ================= */
app.post('/api/check-nfc', async (req, res) => {
    const { nfcData } = req.body;
    if (!nfcData) return res.status(400).json({ found: false, message: 'NFC yok' });

    // Öğrenci ekleme modu: UID yakala, DB kontrolü yapma
    if (waitingForNfc) {
        lastNfcUid = nfcData;
        console.log('🆕 UID alındı (öğrenci ekleme):', nfcData);

        return res.json({
            found: true,
            uid: nfcData,
            message: 'UID qebul edildi',
            timestamp: new Date()
        });
    }

    // Normal yoklama: DB’den kontrol
    try {
        const student = await Student.findOne({ nfcData });

        const response = student
            ? { found: true, message: `${student.name} dərstə` }
            : { found: false, message: 'Bilinməyən kart' };

        scanHistory.unshift({ ...response, timestamp: new Date() });
        if (scanHistory.length > 50) scanHistory.pop();

        return res.json(response);
    } catch (err) {
        console.error('❌ CHECK NFC DB ERROR:', err);
        return res.status(500).json({ found: false, message: 'DB xətası' });
    }
});

/* ================= LAST NFC (Dashboard polling burayı çağırır) ================= */
app.get('/api/nfc/latest', (req, res) => {
    res.json({ uid: lastNfcUid });
});

/* ================= ADD STUDENT (Dashboard Kaydet) ================= */
app.post('/api/students', async (req, res) => {
    const { name, nfcUid } = req.body;
    if (!name || !nfcUid) return res.status(400).json({ message: 'Əksik bilgi' });

    try {
        // Model alanı nfcData => nfcUid'i nfcData olarak kaydedeceğiz
        const exists = await Student.findOne({ nfcData: nfcUid });
        if (exists) return res.status(409).json({ message: 'Bu NFC artiq qeydiyyatlidir' });

        await new Student({
            name: name,
            nfcData: nfcUid
        }).save();

        // Reset: ekleme modu bitsin
        waitingForNfc = false;
        lastNfcUid = null;

        console.log('✅ Yeni telebe elave olundu:', name, nfcUid);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ STUDENT SAVE ERROR:', err);
        // unique hatasını net verelim
        if (err?.code === 11000) {
            return res.status(409).json({ message: 'Bu NFC artıq qeydiyyatlıdır' });
        }
        res.status(500).json({ message: 'Qeydiyyat xətası' });
    }
});

/* ================= HISTORY ================= */
app.get('/api/scan-history', (req, res) => {
    res.json(scanHistory);
});

/* ================= START ================= */
app.listen(PORT, () => {
    console.log(`🚀 Backend running on ${PORT}`);
});
