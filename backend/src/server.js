require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Student = require('./models/Student');

const app = express();
const PORT = process.env.PORT || 5000;

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= DB BAGLANTI ================= */
const FORCE_OFFLINE = false;

if (!FORCE_OFFLINE) {
    mongoose.connect(
        'mongodb://nfcuser:StrongPassword123@127.0.0.1:27017/nfcAttendanceDB?authSource=nfcAttendanceDB'
    ).then(() => {
        console.log('MongoDB qoşuldu');
    }).catch(() => {
        console.log('MongoDB xətası – Offline moda keçildi');
    });
} else {
    console.log('OFFLINE MOD AKTİV');
}

/* ================= LOGIN ================= */
const ADMIN_USER = { username: 'elxan', password: '1234' };

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
        return res.json({ success: true });
    }
    res.status(401).json({ success: false });
});

/* ================= NFC GLOBAL STATE ================= */
let scanHistory = [];
let waitingForNfc = false;
let lastNfcUid = null;

/* ================= NFC START WAIT ================= */
app.post('/api/nfc/start-wait', (req, res) => {
    waitingForNfc = true;
    lastNfcUid = null;

    console.log('📡 NFC BEKLEME MODU AKTİF');

    res.json({ success: true });
});

/* ================= NFC CHECK ================= */
app.post('/api/check-nfc', async (req, res) => {
    const { nfcData } = req.body;
    if (!nfcData) return res.status(400).json({ found: false });

    // 👉 ÖĞRENCİ EKLEME MODU
    if (waitingForNfc) {
        lastNfcUid = nfcData;

        console.log('🆕 Öğrenci ekleme için NFC alındı:', nfcData);

        return res.json({
            found: true,
            name: null,
            message: 'NFC UID alındı (öğrenci ekleme)',
            uid: nfcData,
            timestamp: new Date()
        });
    }

    /* ===== NORMAL YOKLAMA ===== */
    let responseData;

    // OFFLINE
    if (mongoose.connection.readyState !== 1) {
        if (nfcData === "0x00 0x00") {
            responseData = {
                found: true,
                message: "Elxan Kerimov derste",
                timestamp: new Date()
            };
        } else {
            responseData = {
                found: false,
                message: "Tanımsız kart",
                timestamp: new Date()
            };
        }
    }
    // ONLINE
    else {
        try {
            const student = await Student.findOne({ nfcUid: nfcData });

            if (student) {
                responseData = {
                    found: true,
                    message: `${student.fullName} derste`,
                    timestamp: new Date()
                };
            } else {
                responseData = {
                    found: false,
                    message: "Tanımsız kart",
                    timestamp: new Date()
                };
            }
        } catch (err) {
            return res.status(500).json({ found: false });
        }
    }

    scanHistory.unshift(responseData);
    if (scanHistory.length > 50) scanHistory.pop();

    res.json(responseData);
});

/* ================= GET LAST NFC ================= */
app.get('/api/nfc/latest', (req, res) => {
    res.json({ uid: lastNfcUid });
});

/* ================= ADD STUDENT ================= */
app.post('/api/students', async (req, res) => {
    const { name, nfcUid } = req.body;

    if (!name || !nfcUid) {
        return res.status(400).json({ message: 'Eksik bilgi' });
    }

    try {
        const exists = await Student.findOne({ nfcUid });
        if (exists) {
            return res.status(409).json({ message: 'Bu NFC zaten kayıtlı' });
        }

        const student = new Student({
            fullName: name,
            nfcUid
        });

        await student.save();

        // STATE RESET
        waitingForNfc = false;
        lastNfcUid = null;

        console.log('✅ Yeni öğrenci eklendi:', name);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'DB xətası' });
    }
});

/* ================= HISTORY ================= */
app.get('/api/scan-history', (req, res) => {
    res.json(scanHistory);
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda işləyir`);
});
