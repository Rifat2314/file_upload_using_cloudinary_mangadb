const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Debug: Check if environment variables are loaded
console.log('Environment variables check:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Loaded' : '✗ Missing');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✓ Loaded' : '✗ Missing');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✓ Loaded' : '✗ Missing');

// Validate Cloudinary configuration
if (!process.env.CLOUDINARY_CLOUD_NAME || 
    !process.env.CLOUDINARY_API_KEY || 
    !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ Missing Cloudinary environment variables!');
  console.error('Please check your .env file');
} else {
  console.log('✅ Cloudinary environment variables are present');
}

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Test Cloudinary connection
async function testCloudinaryConnection() {
  try {
    // Simple test to verify Cloudinary credentials
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary connection successful');
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error.message);
    console.log('Please check your Cloudinary credentials in the .env file');
  }
}

testCloudinaryConnection();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fileupload';
mongoose.connect(MONGODB_URI)
  .then(function() {
    console.log('✅ Connected to MongoDB');
  })
  .catch(function(err) {
    console.error('❌ MongoDB connection error:', err);
  });

// File model
const fileSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  cloudinaryUrl: String,
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

const File = mongoose.model('File', fileSchema);

// Multer configuration (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Test route
app.get('/api/test', function(req, res) {
  res.json({ 
    message: 'Backend is working!',
    cloudinary_configured: !!process.env.CLOUDINARY_CLOUD_NAME
  });
});

// Upload endpoint with enhanced error handling
app.post('/api/upload', upload.single('file'), async function(req, res) {
  try {
    console.log('📤 Upload request received');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📄 File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Upload to Cloudinary with better error handling
    const result = await new Promise(function(resolve, reject) {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          resource_type: 'auto',
          folder: 'mern-uploads'
        },
        function(error, result) {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(new Error(`Cloudinary error: ${error.message}`));
          } else {
            console.log('✅ Cloudinary upload successful');
            console.log('🔗 URL:', result.secure_url);
            resolve(result);
          }
        }
      );
      
      // Handle stream errors
      uploadStream.on('error', (error) => {
        console.error('❌ Stream error:', error);
        reject(new Error(`Stream error: ${error.message}`));
      });
      
      uploadStream.end(req.file.buffer);
    });

    // Save to MongoDB
    const fileDoc = new File({
      filename: req.file.originalname,
      originalName: req.file.originalname,
      cloudinaryUrl: result.secure_url
    });

    await fileDoc.save();

    res.json({
      message: 'File uploaded successfully',
      file: {
        id: fileDoc._id,
        filename: fileDoc.filename,
        url: fileDoc.cloudinaryUrl,
        uploadDate: fileDoc.uploadDate
      }
    });
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message
    });
  }
});

// Get all files endpoint
app.get('/api/files', async function(req, res) {
  try {
    const files = await File.find().sort({ uploadDate: -1 });
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Delete file endpoint
app.delete('/api/files/:id', async function(req, res) {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // For now, just delete from MongoDB until Cloudinary is working
    await File.findByIdAndDelete(req.params.id);

    res.json({ message: 'File deleted from database' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Health check route
app.get('/health', function(req, res) {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cloudinary_configured: !!process.env.CLOUDINARY_CLOUD_NAME
  });
});

app.listen(PORT, function() {
  console.log('🚀 Server running on port ' + PORT);
  console.log('🔗 Test the backend: http://localhost:' + PORT + '/api/test');
  console.log('❤️  Health check: http://localhost:' + PORT + '/health');
});