require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('./models/Student');
const StudentAuth = require('./models/StudentAuth');
const Attendance = require('./models/Attendance');
const SystemSettings = require('./models/SystemSettings');
const LessonSchedule = require('./models/LessonSchedule');
const { startScheduler, checkAttendance, resetDailyAttendance } = require('./services/attendanceScheduler');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'supersecretkey123'; // Productionda .env'den alınmalı

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= SCHEDULER ================= */
startScheduler();

/* ================= DB ================= */
mongoose.connect(
    'mongodb://nfcuser:StrongPassword123@127.0.0.1:27017/nfcAttendanceDB?authSource=nfcAttendanceDB'
).then(() => {
    console.log('✅ MongoDB connected');
}).catch(err => {
    console.error('❌ MongoDB error:', err.message);
});

/* ================= AUTH MIDDLEWARE ================= */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

/* ================= ADMIN LOGIN ================= */
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'elxan' && password === '1234') {
        return res.json({ success: true });
    }
    res.status(401).json({ success: false });
});

/* ================= STUDENT LOGIN ================= */
app.post('/api/student/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const studentAuth = await StudentAuth.findOne({ username });
        if (!studentAuth) {
            return res.status(400).json({ message: 'İstifadəçi tapılmadı' });
        }

        const isMatch = await bcrypt.compare(password, studentAuth.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Şifrə yanlışdır' });
        }

        // Token oluştur
        const token = jwt.sign(
            { id: studentAuth.studentId, username: studentAuth.username, role: 'student' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            success: true,
            token,
            user: {
                studentId: studentAuth.studentId,
                name: studentAuth.name,
                nfcUid: studentAuth.nfcUid,
                username: studentAuth.username,
                courseGroup: studentAuth.courseGroup
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server xətası' });
    }
});

/* ================= GET CURRENT STUDENT INFO ================= */
app.get('/api/student/me', authenticateToken, async (req, res) => {
    try {
        // req.user JWT'den geliyor
        const studentAuth = await StudentAuth.findOne({ studentId: req.user.id });
        if (!studentAuth) return res.status(404).json({ message: 'Tələbə tapılmadı' });

        // Öğrenciye özel scan history filtrele
        const myHistory = scanHistory.filter(scan => scan.uid === studentAuth.nfcUid);

        res.json({
            user: {
                name: studentAuth.name,
                nfcUid: studentAuth.nfcUid,
                courseGroup: studentAuth.courseGroup
            },
            history: myHistory
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server xətası' });
    }
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

/* ================= NFC CANCEL ================= */
app.post('/api/nfc/cancel', (req, res) => {
    waitingForAdd = false;
    waitingForDelete = false;
    lastNfcUid = null;

    console.log('🛑 NFC modu ləğv edildi (Durdurldu)');
    res.json({ success: true });
});

/* ================= NFC CHECK (GSM / SIM868) ================= */
app.post('/api/check-nfc', async (req, res) => {
    const { nfcData } = req.body;
    if (!nfcData) {
        return res.status(400).json({ found: false, message: 'NFC yoxdur' });
    }

    /* ===== EKLEME MODU ===== */
    if (waitingForAdd) {
        waitingForAdd = false;
        lastNfcUid = nfcData;

        console.log('🆕 UID alındı (ekleme):', nfcData);

        return res.json({
            found: true,
            uid: nfcData,
            message: 'UID alindi'
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

        if (student) {
            // --- ATTENDANCE LOGIC (BAKU TIME) ---
            // Create a date object that represents Baku time
            const now = new Date();
            const bakuDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Baku' }));

            const year = bakuDate.getFullYear();
            const month = String(bakuDate.getMonth() + 1).padStart(2, '0');
            const day = String(bakuDate.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            const timeStr = `${String(bakuDate.getHours()).padStart(2, '0')}:${String(bakuDate.getMinutes()).padStart(2, '0')}`;

            // --- FETCH SETTINGS FOR TIME COMPARISON ---
            // 1. Check specific schedule for this date
            let lessonStartTime = '09:00';
            const schedule = await LessonSchedule.findOne({ date: todayStr });
            if (schedule) {
                lessonStartTime = schedule.startTime;
            } else {
                // 2. Fallback to global setting
                const settings = await SystemSettings.findOne({ key: 'lessonInfo' });
                lessonStartTime = settings?.value?.lessonStartTime || '09:00';
            }

            // Determine status based on time
            // Compare HH:MM strings (e.g. "09:05" > "09:00" is true)
            const scanStatus = (timeStr > lessonStartTime) ? 'late' : 'present';

            let attRecord = await Attendance.findOne({ studentId: student._id, date: todayStr });

            let statusMessage = (scanStatus === 'late') ? 'Gecikdi' : 'Vaxtında';

            if (!attRecord) {
                // First scan -> Use calculated status
                attRecord = await Attendance.create({
                    studentId: student._id,
                    nfcUid: nfcData,
                    date: todayStr,
                    time: timeStr,   // Baku Time HH:mm
                    status: scanStatus,
                    scanTime: now,   // Actual UTC timestamp
                    autoMarked: false
                });
            } else if (attRecord.status === 'absent') {
                // Was marked absent -> Update with correct status (Present or Late)
                attRecord.status = scanStatus;
                attRecord.scanTime = now;
                attRecord.time = timeStr; // Update to actual Baku scan time
                attRecord.autoMarked = false;
                await attRecord.save();
                // statusMessage set above
            } else {
                statusMessage = 'Artıq qeyd olunub';
            }

            const response = {
                found: true,
                message: `${student.name} dərsdə (${statusMessage})`,
                uid: nfcData,
                name: student.name
            };

            scanHistory.unshift({ ...response, timestamp: now });
            if (scanHistory.length > 50) scanHistory.pop();

            return res.json(response);
        }

        // Unknown card
        const response = { found: false, message: 'Bilinmeyen kart', uid: nfcData };
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

/* ================= ADD STUDENT (UPDATED) ================= */
app.post('/api/students', async (req, res) => {
    const { name, nfcUid, username, password } = req.body;

    // Basit validasyon
    if (!name || !nfcUid || !username || !password) {
        return res.status(400).json({ message: 'Əksik Bilgi: Ad, UID, Username və Şifrə doldurulmalıdır.' });
    }

    try {
        // 1. Check if NFC exists
        const exists = await Student.findOne({ nfcData: nfcUid });
        if (exists) {
            return res.status(409).json({ message: 'Bu NFC ARTIQ QEYDIYYATDADIR' });
        }

        // 2. Check if Username exists
        const authExists = await StudentAuth.findOne({ username });
        if (authExists) {
            return res.status(409).json({ message: 'Bu istifadəçi adı artıq tutulub' });
        }

        // 3. Create Student
        const newStudent = new Student({
            name,
            nfcData: nfcUid
        });
        const savedStudent = await newStudent.save();

        // 4. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 5. Create StudentAuth
        const newAuth = new StudentAuth({
            studentId: savedStudent._id,
            name: name,
            username: username,
            password: hashedPassword,
            nfcUid: nfcUid,
            courseGroup: req.body.courseGroup || ''
        });
        await newAuth.save();

        lastNfcUid = null;

        console.log('✅ Yeni tələbə və giriş məlumatları əlavə olundu:', name);
        res.json({ success: true });

    } catch (err) {
        console.error('❌ STUDENT SAVE ERROR:', err);
        res.status(500).json({ message: 'Qeydiyyat xətası: ' + err.message });
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
        // 1. Delete Student
        const deleted = await Student.findOneAndDelete({ nfcData: nfcUid });

        if (!deleted) {
            console.log('❌ DB-də tapılmadı:', nfcUid);
            return res.status(404).json({ message: 'TELEBE TAPILMADI' });
        }

        // 2. Delete StudentAuth
        await StudentAuth.findOneAndDelete({ nfcUid: nfcUid });

        console.log('🗑️ Tələbə və giriş məlumatı silindi:', deleted.name);
        res.json({ success: true, name: deleted.name });

    } catch (err) {
        console.error('❌ DELETE ERROR:', err);
        res.status(500).json({ message: 'Silme xetası' });
    }
});

/* ================= ATTENDANCE ROUTES ================= */

// 1. Get Daily Attendance (Admin)
app.get('/api/attendance/daily', async (req, res) => {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.status(400).json({ message: 'Tarix lazımdır' });

    try {
        const records = await Attendance.find({ date }).populate('studentId', 'name');

        // Enhance with courseGroup from StudentAuth
        const enhancedRecords = await Promise.all(records.map(async (record) => {
            // Check if studentId exists (it might be null if student deleted)
            if (!record.studentId) return record;

            const auth = await StudentAuth.findOne({ studentId: record.studentId._id });
            return {
                ...record.toObject(),
                courseGroup: auth ? auth.courseGroup : '',
                studentName: record.studentId.name // Flatten for easier frontend use
            };
        }));

        res.json(enhancedRecords);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Xəta' });
    }
});

// 2. Get My History (Student)
app.get('/api/attendance/my-history', authenticateToken, async (req, res) => {
    try {
        // req.user.id is studentId (from StudentAuth)
        // StudentAuth.studentId refers to Student._id
        const records = await Attendance.find({ studentId: req.user.id }).sort({ date: -1 });
        res.json(records);
    } catch (err) {
        res.status(500).json({ message: 'Xəta' });
    }
});

/* ================= SETTINGS ROUTES ================= */

// Legacy Global Settings (Forward to Schedule API logic optionally, or keep simple)
app.post('/api/settings/lesson-time', async (req, res) => {
    // This now updates the GLOBAL default
    const { startTime, endTime } = req.body;
    try {
        await SystemSettings.findOneAndUpdate(
            { key: 'lessonInfo' },
            { value: { lessonStartTime: startTime, lessonEndTime: endTime } },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Ayarlar xətası' });
    }
});

app.get('/api/settings/lesson-time', async (req, res) => {
    try {
        const settings = await SystemSettings.findOne({ key: 'lessonInfo' });
        res.json(settings?.value || { lessonStartTime: '09:00', lessonEndTime: '10:00' });
    } catch (err) {
        res.status(500).json({ message: 'Xəta' });
    }
});

// NEW: Schedule API
app.get('/api/settings/schedule', async (req, res) => {
    const { date } = req.query; // YYYY-MM-DD
    try {
        if (date) {
            const schedule = await LessonSchedule.findOne({ date });
            if (schedule) {
                return res.json({
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    isCustom: true
                });
            }
        }
        // Fallback to global
        const settings = await SystemSettings.findOne({ key: 'lessonInfo' });
        res.json(settings?.value || { lessonStartTime: '09:00', lessonEndTime: '10:00', isCustom: false });
    } catch (err) {
        res.status(500).json({ message: 'Xəta' });
    }
});

app.post('/api/settings/schedule', async (req, res) => {
    const { date, startTime, endTime } = req.body;

    // Helper to get today's date string (Baku) for global reset
    const getBakuToday = () => {
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Baku' }));
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // If no date provided, save as global default
    if (!date) {
        try {
            await SystemSettings.findOneAndUpdate(
                { key: 'lessonInfo' },
                { value: { lessonStartTime: startTime, lessonEndTime: endTime } },
                { upsert: true, new: true }
            );

            // Trigger RESET for today because global settings changed
            // This satisfies "reset if schedule changes"
            await resetDailyAttendance(getBakuToday());
            await checkAttendance(); // Re-run check to mark new absents if needed

            return res.json({ success: true, type: 'global' });
        } catch (err) {
            return res.status(500).json({ message: 'Global ayar xətası' });
        }
    }

    // Save for specific date
    try {
        await LessonSchedule.findOneAndUpdate(
            { date },
            { startTime, endTime },
            { upsert: true, new: true }
        );

        // Reset ONLY for the specific date provided
        await resetDailyAttendance(date);
        // If the date is 'today', we might want to re-check attendance immediately
        if (date === getBakuToday()) {
            await checkAttendance();
        }

        res.json({ success: true, type: 'custom' });
    } catch (err) {
        res.status(500).json({ message: 'Tarix ayarı xətası' });
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
