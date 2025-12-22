const cron = require('node-cron');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const SystemSettings = require('../models/SystemSettings');

// Default lesson time if not set
const DEFAULT_START_TIME = '09:00';

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

        // 2. Check if current time is past start time + buffer (e.g. 1 min)
        const now = new Date();
        const [hours, minutes] = startTime.split(':').map(Number);

        const lessonDate = new Date();
        lessonDate.setHours(hours, minutes, 0, 0);

        // Only run if we are past the start time
        if (now < lessonDate) {
            console.log('⏳ Too early for attendance check. Waiting for ' + startTime);
            return;
        }

        const todayStr = getTodayDateString();

        // 3. Find all students
        const allStudents = await Student.find({});

        for (const student of allStudents) {
            // 4. Check if attendance record exists for today
            const exists = await Attendance.findOne({
                studentId: student._id,
                date: todayStr
            });

            // 5. If NO record exists, mark as ABSENT
            if (!exists) {
                console.log(`❌ Marking Absent: ${student.name}`);
                await Attendance.create({
                    studentId: student._id,
                    nfcUid: student.nfcData,
                    date: todayStr,
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
