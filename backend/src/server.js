require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Student = require('./models/Student');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Bağlantısı - MongoDB Connection
const FORCE_OFFLINE = false; // Offline modu manuel olarak kontrol et

if (!FORCE_OFFLINE) {
    mongoose.connect('mongodb://nfcuser:StrongPassword123@127.0.0.1:27017/nfcAttendanceDB?authSource=nfcAttendanceDB').then(() => {
        console.log('MongoDB Database qoşuldu.');
    }).catch((err) => {
        console.error('MongoDB qoşulma xətası: (Offline modda başlayacaq)');
    });
} else {
    console.log('⚠️ OFFLINE MOD AKTİV: Database qoşulmayacaq.');
}


let scanHistory = [];
// Sabit Kullanıcı (Admin)
const ADMIN_USER = {
    username: 'elxan',
    password: '1234'
};

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
        return res.json({ success: true, message: 'Giriş uğurlu' });
    }

    res.status(401).json({ success: false, message: 'Xətalı istifadəçi adı və ya şifrə' });
});


app.post('/api/check-nfc', async (req, res) => {
    const { nfcData } = req.body;
    if (!nfcData) return res.status(400).json({ message: 'NFC bilgisi çatışmır' });

    let responseData;

    // Fallback Mode: DB Bağlı Değilse
    if (mongoose.connection.readyState !== 1) {
        console.warn("⚠️ Offline Mod: DB yox, mock cavab verir.");

        if (nfcData === "0x00 0x00") {
            responseData = { found: true, message: "Elxan Kerimov dərstə iştirak edir (Offline)", timestamp: new Date() };
        } else {
            responseData = { found: false, message: "Istifadəçi tapılmadı (Offline)", timestamp: new Date() };
        }
    } else {
        // Normal DB Modu
        try {
            const student = await Student.findOne({ nfcData });

            if (student) {
                responseData = { found: true, message: `${student.name} dərstə iştirak edir`, timestamp: new Date() };
            } else {
                responseData = { found: false, message: 'Istifadəçi tapılmadı', timestamp: new Date() };
            }
        } catch (error) {
            console.error('NFC idarə xətası:', error);
            return res.status(500).json({ message: 'Sunucu xətası' });
        }
    }

    // Geçmişe ekle (En yeni en başta)
    scanHistory.unshift(responseData);
    // İsteğe bağlı: Geçmişi sınırla (örn. son 50 kayıt)
    if (scanHistory.length > 50) scanHistory.pop();

    res.json(responseData);
});

app.get('/api/last-scan', (req, res) => {
    res.json(scanHistory[0] || { message: 'Hələ data gelmədi' });
});

app.get('/api/scan-history', (req, res) => {
    res.json(scanHistory);
});

app.post('/api/seed', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.json({ message: "Offline mod: Data əlavə olunmadı amma simülasiya işləyir." });
    }

    try {
        const exists = await Student.findOne({ nfcData: "0x00 0x00" });
        if (!exists) {
            await Student.create({ name: "Elxan Kerimov", nfcData: "0x00 0x00" });
            res.json({ message: "Test datası əlavə olundu: Elxan Kerimov" });
        } else {
            res.json({ message: "Test datası artıq var" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda işləyir...`);
});
