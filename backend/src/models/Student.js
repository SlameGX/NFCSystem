const mongoose = require('mongoose');

// Öğrenci şeması - Student Schema
// MongoDB'de tutulacak verilerin yapısını belirler
const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  nfcData: {
    type: String, // "0x00 0x00" formatında
    required: true,
    unique: true // Her öğrencinin NFC kartı benzersiz olmalı
  }
});

// Modeli dışa aktar - Export the model
module.exports = mongoose.model('Student', studentSchema);
