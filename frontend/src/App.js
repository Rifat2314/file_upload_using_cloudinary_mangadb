import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// For development - use full URL to backend
const API_BASE_URL = 'https://file-upload-using-cloudinary-mangad.vercel.app/api';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');

  // Fetch files on component mount
  useEffect(() => {
    fetchFiles();
    testBackendConnection();
  }, []);

  const testBackendConnection = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/test`);
      console.log('Backend connection test:', response.data);
    } catch (error) {
      console.error('Backend connection failed:', error);
      setMessage('Cannot connect to backend server. Make sure it\'s running on port 5000.');
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/files`);
      setFiles(response.data);
    } catch (error) {
      console.error('Error fetching files:', error);
      setMessage('Error fetching files. Make sure backend is running.');
    }
  };

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files[0]);
    setMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Please select a file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setMessage('File uploaded successfully!');
      setSelectedFile(null);
      document.getElementById('file-input').value = '';
      fetchFiles(); // Refresh the file list
    } catch (error) {
      console.error('Upload error:', error);
      if (error.response) {
        setMessage(`Upload failed: ${error.response.data.error}`);
      } else if (error.request) {
        setMessage('Upload failed: Cannot connect to server');
      } else {
        setMessage('Upload failed: ' + error.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/files/${fileId}`);
      setMessage('File deleted successfully');
      fetchFiles(); // Refresh the file list
    } catch (error) {
      console.error('Delete error:', error);
      setMessage('Delete failed: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h1>File Upload with MERN + Cloudinary</h1>
        
        {/* Upload Section */}
        <div className="upload-section">
          <input
            id="file-input"
            type="file"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <button 
            onClick={handleUpload} 
            disabled={!selectedFile || uploading}
            className="upload-btn"
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {/* Files List */}
        <div className="files-section">
          <h2>Uploaded Files ({files.length})</h2>
          {files.length === 0 ? (
            <p className="no-files">No files uploaded yet.</p>
          ) : (
            <div className="files-grid">
              {files.map((file) => (
                <div key={file._id} className="file-card">
                  {/* Image Display */}
                  <img 
                    src={file.cloudinaryUrl} 
                    alt={file.filename}
                    className="file-image"
                  />
                  
                  <div className="file-info">
                    <h3>{file.originalName}</h3>
                    <p>Uploaded: {new Date(file.uploadDate).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="file-actions">
                    <button 
                      onClick={() => handleDelete(file._id)}
                      className="delete-btn"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
