const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      const error = new Error('Jenis lampiran tidak disokong');
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  },
});

const scheduleUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'application/pdf'];
    const isCsv = file.originalname.toLowerCase().endsWith('.csv')
      && ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream'].includes(file.mimetype);
    if (!allowed.includes(file.mimetype) && !isCsv) {
      const error = new Error('Jenis fail jadual tidak disokong');
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  },
});

const removeInvalidUploads = async (files) => {
  await Promise.all(files.map((file) => fsPromises.unlink(file.path).catch((error) => {
    console.error(`Failed to remove rejected upload ${file.filename}:`, error);
  })));
};

const validateEvidenceUploads = async (req, res, next) => {
  const files = req.files || [];
  try {
    for (const file of files) {
      const header = await fsPromises.readFile(file.path).then((buffer) => buffer.subarray(0, 12));
      const valid = file.mimetype === 'image/jpeg'
        ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
        : file.mimetype === 'image/png'
          ? header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : file.mimetype === 'image/webp'
            ? header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP'
            : header.toString('ascii', 0, 5) === '%PDF-';
      if (!valid) {
        await removeInvalidUploads(files);
        const error = new Error('Kandungan fail tidak sepadan dengan jenis lampiran');
        error.status = 400;
        return next(error);
      }
    }
    next();
  } catch (error) {
    await removeInvalidUploads(files);
    next(error);
  }
};

const validateScheduleUpload = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const extension = path.extname(req.file.originalname).toLowerCase();
    const header = await fsPromises.readFile(req.file.path).then((buffer) => buffer.subarray(0, 8));
    const valid = extension === '.pdf'
      ? req.file.mimetype === 'application/pdf' && header.toString('ascii', 0, 5) === '%PDF-'
      : extension === '.csv' && !header.includes(0);
    if (!valid) {
      await removeInvalidUploads([req.file]);
      const error = new Error('Kandungan fail tidak sepadan dengan format CSV atau PDF');
      error.status = 400;
      return next(error);
    }
    next();
  } catch (error) {
    await removeInvalidUploads([req.file]);
    next(error);
  }
};

module.exports = { upload, scheduleUpload, validateEvidenceUploads, validateScheduleUpload };
