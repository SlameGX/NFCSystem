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

let waitingForAdd = false;     // öğrenci ekleme NFC modu
let waitingForDelete = false;  // öğrenci silme NFC okuma modu
let lastNfcUid = null;

/* ================= NFC START (EKLEME) ================= */
app.post('/api/nfc/start-wait', (req, res) => {
    waitingForAdd = true;
    waitingForDelete = false;
    lastNfcUid = null;

    console.log('📡 NFC EKLEME modu aktif');
    res.json({ success: true });
});

/* ================= NFC START (SİLME OKUMA) ================= */
app.post('/api/nfc/start-delete', (req, res) => {
    waitingForDelete = true;
    waitingForAdd = false;
    lastNfcUid = null;

    console.log('🗑️ NFC SİLME OKUMA modu aktif');
    res.json({ success: true });
});

/* ================= NFC CHECK (GSM / SIM868) ================= */
app.post('/api/check-nfc', async (req, res) => {
    const { nfcData } = req.body;
    if (!nfcData) {
        return res.status(400).json({ found: false, message: 'NFC yok' });
    }

    /* ===== EKLEME MODU ===== */
    if (waitingForAdd) {
        waitingForAdd = false;
        lastNfcUid = nfcData;

        console.log('🆕 UID alındı (ekleme):', nfcData);

        return res.json({
            found: true,
            uid: nfcData,
            message: 'UID alındı'
        });
    }

    /* ===== SİLME OKUMA MODU (SADECE UID AL) ===== */
    if (waitingForDelete) {
        waitingForDelete = false;
        lastNfcUid = nfcData;

        console.log('🟡 Silme ucun UID alindi:', nfcData);

        return res.json({
            found: true,
            uid: nfcData,
            message: 'Silme ucun UID alindi'
        });
    }

    /* ===== NORMAL YOKLAMA ===== */
    try {
        const student = await Student.findOne({ nfcData });

        const response = student
            ? { found: true, message: `${student.name} dərsdə` }
            : { found: false, message: 'Bilinmeyen kart' };

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
        return res.status(400).json({ message: 'EKSIK BILGI' });
    }

    try {
        const exists = await Student.findOne({ nfcData: nfcUid });
        if (exists) {
            return res.status(409).json({ message: 'Bu NFC ARTIQ QEYDIYYATDADIR' });
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

/* ================= DELETE STUDENT (GARANTİ) ================= */
app.post('/api/students/delete', async (req, res) => {
    const { nfcUid } = req.body;

    if (!nfcUid) {
        return res.status(400).json({ message: 'UID yoxdur' });
    }

    console.log('🧪 DELETE REQUEST UID:', nfcUid);

    try {
        const deleted = await Student.findOneAndDelete({ nfcData: nfcUid });

        if (!deleted) {
            console.log('❌ DB-də tapılmadı:', nfcUid);
            return res.status(404).json({ message: 'TELEBE TAPILMADI' });
        }

        console.log('🗑️ Tələbə silindi:', deleted.name);
        res.json({ success: true, name: deleted.name });

    } catch (err) {
        console.error('❌ DELETE ERROR:', err);
        res.status(500).json({ message: 'Silme xetası' });
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
