const cron = require('node-cron');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const SystemSettings = require('../models/SystemSettings');

// Default lesson time if not set
const DEFAULT_START_TIME = '05:54';

const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const checkAttendance = async () => {
    console.log('⏰ Running daily attendance check...');

    try {
        // 1. Get Lesson Start Time
        const settings = await SystemSettings.findOne({ key: 'lessonInfo' });
        const startTime = settings?.value?.lessonStartTime || DEFAULT_START_TIME;

        // 2. Check if current time is past start time
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTimeVal = currentHours * 60 + currentMinutes;

        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const startTimeVal = startHours * 60 + startMinutes;

        // If current time is LESS than start time, do nothing (wait for lesson to start)
        if (currentTimeVal < startTimeVal) {
            console.log(`⏳ Too early for attendance check. Current: ${currentHours}:${currentMinutes}, Start: ${startTime}`);
            return;
        }

        const todayStr = getTodayDateString();
        // Format time as HH:mm
        const timeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

        // 3. Find all students
        const allStudents = await Student.find({});

        for (const student of allStudents) {
            // 4. Check if attendance record exists for today
            const exists = await Attendance.findOne({
                studentId: student._id,
                date: todayStr
            });

            // 5. If NO record exists, mark as ABSENT
            // (If they already scanned, exists will be true, so we skip)
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
    // Run every 5 minutes to ensure we cover the time even if restart happens
    // Does not duplicate because we check if record exists
    cron.schedule('*/5 * * * *', checkAttendance);
    console.log('📅 Attendance Scheduler Started (Runs every 5 mins)');
};

module.exports = { startScheduler, checkAttendance };
