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
let waitingForNfc = false;        // öğrenci ekleme
let deleteReadMode = false;      // silme için NFC okuma
let lastNfcUid = null;
let pendingDeleteUid = null;     // silme bekleyen UID

/* ================= DEBUG ================= */
app.post('/api/_debug/post-test', (req, res) => {
    res.json({ ok: true, body: req.body });
});

/* ================= NFC START (EKLEME) ================= */
app.post('/api/nfc/start-wait', (req, res) => {
    waitingForNfc = true;
    deleteReadMode = false;
    lastNfcUid = null;

    console.log('📡 NFC EKLEME modu aktif');
    res.json({ success: true });
});

/* ================= NFC START (SİLME OKUMA) ================= */
app.post('/api/nfc/start-delete', (req, res) => {
    deleteReadMode = true;
    waitingForNfc = false;
    lastNfcUid = null;
    pendingDeleteUid = null;

    console.log('🗑️ NFC SİLME OKUMA modu aktif');
    res.json({ success: true });
});

/* ================= NFC CHECK ================= */
app.post('/api/check-nfc', async (req, res) => {
    const { nfcData } = req.body;
    if (!nfcData) {
        return res.status(400).json({ found: false, message: 'NFC yok' });
    }

    /* ======== EKLEME MODU ======== */
    if (waitingForNfc) {
        lastNfcUid = nfcData;
        waitingForNfc = false;

        console.log('🆕 UID alındı (ekleme):', nfcData);

        return res.json({
            found: true,
            uid: nfcData,
            message: 'UID qəbul edildi'
        });
    }

    /* ======== SİLME OKUMA MODU (SADECE OKU) ======== */
    if (deleteReadMode) {
        pendingDeleteUid = nfcData;
        lastNfcUid = nfcData;
        deleteReadMode = false;

        console.log('🟡 Silme için UID alındı:', nfcData);

        return res.json({
            found: true,
            uid: nfcData,
            message: 'Silme üçün UID alındı'
        });
    }

    /* ======== NORMAL YOKLAMA ======== */
    try {
        const student = await Student.findOne({ nfcData });

        const response = student
            ? { found: true, message: `${student.name} dərsdə` }
            : { found: false, message: 'Bilinməyən kart' };

        scanHistory.unshift({ ...response, timestamp: new Date() });
        if (scanHistory.length > 50) scanHistory.pop();

        return res.json(response);
    } catch (err) {
        console.error('❌ CHECK NFC ERROR:', err);
        return res.status(500).json({ found: false, message: 'DB xətası' });
    }
});

/* ================= LAST NFC ================= */
app.get('/api/nfc/latest', (req, res) => {
    res.json({ uid: lastNfcUid });
});

/* ================= ADD STUDENT ================= */
app.post('/api/students', async (req, res) => {
    const { name, nfcUid } = req.body;
    if (!name || !nfcUid) {
        return res.status(400).json({ message: 'Əksik bilgi' });
    }

    try {
        const exists = await Student.findOne({ nfcData: nfcUid });
        if (exists) {
            return res.status(409).json({ message: 'Bu NFC artıq qeydiyyatlıdır' });
        }

        await new Student({
            name,
            nfcData: nfcUid
        }).save();

        lastNfcUid = null;

        console.log('✅ Yeni tələbə əlavə olundu:', name);
        res.json({ success: true });

    } catch (err) {
        console.error('❌ STUDENT SAVE ERROR:', err);
        res.status(500).json({ message: 'Qeydiyyat xətası' });
    }
});

/* ================= CONFIRM DELETE ================= */
app.post('/api/students/delete', async (req, res) => {
    const { nfcUid } = req.body;
    if (!nfcUid || nfcUid !== pendingDeleteUid) {
        return res.status(400).json({ message: 'Yanlış və ya etibarsız UID' });
    }

    try {
        const deleted = await Student.findOneAndDelete({ nfcData: nfcUid });
        pendingDeleteUid = null;
        lastNfcUid = null;

        if (!deleted) {
            return res.status(404).json({ message: 'Tələbə tapılmadı' });
        }

        console.log('🗑️ Tələbə silindi:', deleted.name);
        res.json({ success: true, name: deleted.name });

    } catch (err) {
        console.error('❌ DELETE ERROR:', err);
        res.status(500).json({ message: 'Silme xətası' });
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
