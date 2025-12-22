const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    nfcUid: {
        type: String,
        required: true
    },
    date: {
        type: String, // YYYY-MM-DD format for easy querying
        required: true
    },
    status: {
        type: String,
        enum: ['present', 'absent', 'late'],
        required: true
    },
    scanTime: {
        type: Date
    },
    autoMarked: {
        type: Boolean,
        default: false
    }
});

// Ensure unique record per student per day
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
