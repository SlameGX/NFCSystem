const cron = require('node-cron');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const SystemSettings = require('../models/SystemSettings');

// Default lesson time if not set
const LessonSchedule = require('../models/LessonSchedule');

// Default lesson time if not set
const DEFAULT_START_TIME = '09:00';

// Helper for Baku Time
const getBakuDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Baku' }));

const getTodayDateString = () => {
    const d = getBakuDate();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const checkAttendance = async () => {
    console.log('⏰ Running daily attendance check (Baku Time)...');

    try {
        const todayStr = getTodayDateString(); // Baku date

        // 1. Get Effective Lesson Start Time
        let startTime = DEFAULT_START_TIME;

        // Try specific schedule
        try {
            const schedule = await LessonSchedule.findOne({ date: todayStr });
            if (schedule) startTime = schedule.startTime;
            else {
                // Fallback global
                const settings = await SystemSettings.findOne({ key: 'lessonInfo' });
                if (settings?.value?.lessonStartTime) startTime = settings.value.lessonStartTime;
            }
        } catch (e) {
            console.error('Scheduler settings fetch error:', e);
        }

        // 2. Check if current BAKU time is past start time
        const nowBaku = getBakuDate();
        const currentHours = nowBaku.getHours();
        const currentMinutes = nowBaku.getMinutes();
        const timeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`; // Baku time

        // Simple string compare for HH:MM works (e.g. "09:05" > "09:00")
        if (timeStr < startTime) {
            console.log(`⏳ Lesson hasn't started yet (${timeStr} < ${startTime}). Waiting...`);

            // NEW: If time was changed to later, remove ALL records for today (absent, present, late)
            // This effectively "resets" the day to waiting mode as requested.
            const deleted = await Attendance.deleteMany({
                date: todayStr
            });

            if (deleted.deletedCount > 0) {
                console.log(`🔄 Resetting ${deleted.deletedCount} records (ALL statuses) due to schedule change/wait mode.`);
            }

            return; // EXIT: Do not mark absent yet
        }

        console.log(`🔔 Lesson started (${timeStr} >= ${startTime}). Marking absents...`);

        // 3. Find all students
        const allStudents = await Student.find({});

        for (const student of allStudents) {
            // 4. Check if attendance record exists for today
            const exists = await Attendance.findOne({
                studentId: student._id,
                date: todayStr
            });

            // 5. If NO record exists, mark as ABSENT because lesson has started
            if (!exists) {
                console.log(`❌ Marking Absent: ${student.name}`);
                await Attendance.create({
                    studentId: student._id,
                    nfcUid: student.nfcData || 'NO_CARD',
                    date: todayStr,
                    time: timeStr,
                    status: 'absent',
                    autoMarked: true
                });
            }
        }
        console.log('✅ Daily attendance check completed.');

    } catch (err) {
        console.error('Attendance Check Error:', err);
    }
};



const startScheduler = () => {
    // Run every minute to ensure we cover the time even if restart happens
    // Does not duplicate because we check if record exists
    cron.schedule('* * * * *', checkAttendance);
    console.log('📅 Attendance Scheduler Started (Runs every 1 min)');
};

module.exports = { startScheduler, checkAttendance };
