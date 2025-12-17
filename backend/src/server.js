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

/* ================= NFC START ================= */
app.post('/api/nfc/start-wait', (req, res) => {
    waitingForNfc = true;
    lastNfcUid = null;
    console.log('📡 NFC BEKLEME MODU AKTİF');
    res.json({ success: true });
});

/* ================= NFC CHECK ================= */
app.post('/api/check-nfc', async (req, res) => {
    const { nfcData } = req.body;
    if (!nfcData) return res.status(400).json({ message: 'NFC yok' });

    if (waitingForNfc) {
        lastNfcUid = nfcData;
        return res.json({ uid: nfcData });
    }

    const student = await Student.findOne({ nfcUid: nfcData });
    const response = student
        ? { found: true, message: `${student.fullName} derste` }
        : { found: false, message: 'Tanımsız kart' };

    scanHistory.unshift({ ...response, timestamp: new Date() });
    if (scanHistory.length > 50) scanHistory.pop();

    res.json(response);
});

/* ================= LAST NFC ================= */
app.get('/api/nfc/latest', (req, res) => {
    res.json({ uid: lastNfcUid });
});

/* ================= ADD STUDENT ================= */
app.post('/api/students', async (req, res) => {
    const { name, nfcUid } = req.body;
    if (!name || !nfcUid) return res.status(400).json({ message: 'Eksik' });

    const exists = await Student.findOne({ nfcUid });
    if (exists) return res.status(409).json({ message: 'Zaten kayıtlı' });

    await new Student({ fullName: name, nfcUid }).save();

    waitingForNfc = false;
    lastNfcUid = null;

    res.json({ success: true });
});

/* ================= HISTORY ================= */
app.get('/api/scan-history', (req, res) => {
    res.json(scanHistory);
});

/* ================= START ================= */
app.listen(PORT, () => {
    console.log(`🚀 Backend running on ${PORT}`);
});
