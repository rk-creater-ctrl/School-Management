const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'images');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, safeName);
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      return cb(new Error('Only JPG, PNG, WebP, and GIF images are allowed'));
    }
    cb(null, true);
  },
});

router.use(auth);

function handleImageUpload(req, res) {
  imageUpload.single('image')(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Image upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    res.status(201).json({
      fileName: req.file.filename,
      fileUrl: `/uploads/images/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  });
}

router.post('/image', authorize('superadmin'), handleImageUpload);
router.post('/profile-photo', handleImageUpload);

module.exports = router;
