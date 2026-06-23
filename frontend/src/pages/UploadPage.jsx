import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Upload, Copy, Check, Clock, Trash2, Flame, LogOut, FileText, 
  Image as ImageIcon, Video, Music, File as FileIcon, ExternalLink, AlertTriangle,
  FolderOpen
} from 'lucide-react';
import api from '../utils/api';
import '../styles/upload.css';

function UploadPage() {
  const [bin, setBin] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeUploads, setActiveUploads] = useState({});
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'Agent';

  // Auth Protection check
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // Create bin session on mount
  useEffect(() => {
    const initBin = async () => {
      try {
        const response = await api.post('/create-bin');
        setBin(response.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to initialize a new session bin.');
      } finally {
        setLoading(false);
      }
    };
    initBin();
  }, []);

  // Expiry Countdown Timer
  useEffect(() => {
    if (!bin?.expiresAt) return;

    const updateTimer = () => {
      const difference = new Date(bin.expiresAt) - new Date();
      if (difference <= 0) {
        setTimeLeft('Expired');
        setBin(prev => ({ ...prev, files: [] })); // Clear list locally if expired
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        parts.push(`${hours.toString().padStart(2, '0')}h`);
        parts.push(`${minutes.toString().padStart(2, '0')}m`);
        parts.push(`${seconds.toString().padStart(2, '0')}s`);

        setTimeLeft(parts.join(' '));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [bin?.expiresAt]);

  const isNearingExpiry = () => {
    if (!bin?.expiresAt) return false;
    const difference = new Date(bin.expiresAt) - new Date();
    return difference > 0 && difference < 24 * 60 * 60 * 1000; // Less than 24h
  };

  const getShareUrl = () => {
    if (!bin?.binId) return '';
    return `${window.location.protocol}//${window.location.host}/bin/${bin.binId}`;
  };

  const handleCopy = () => {
    if (!bin?.binId) return;
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  // Drag and Drop triggers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(e.target.files);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  // Sequential uploads via FormData with progress tracking
  const handleFilesUpload = async (filesList) => {
    if (!bin?.binId) return;
    setUploading(true);
    setError('');

    const filesArray = Array.from(filesList);
    
    // Initialize activeUploads with 0% progress for all files
    const initialUploads = {};
    filesArray.forEach((file, index) => {
      const uploadId = `${Date.now()}-${index}-${file.name}`;
      initialUploads[uploadId] = {
        id: uploadId,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'pending' // 'pending', 'uploading', 'completed', 'failed'
      };
    });
    
    setActiveUploads(prev => ({ ...prev, ...initialUploads }));

    // Upload sequentially to avoid MongoDB versioning conflicts and optimize bandwidth
    let latestBin = bin;
    for (const uploadItem of Object.values(initialUploads)) {
      const fileToUpload = filesArray.find(f => f.name === uploadItem.name && f.size === uploadItem.size);
      if (!fileToUpload) continue;

      // Update status to 'uploading'
      setActiveUploads(prev => ({
        ...prev,
        [uploadItem.id]: { ...prev[uploadItem.id], status: 'uploading' }
      }));

      const formData = new FormData();
      formData.append('file', fileToUpload);

      try {
        const response = await api.post(`/bins/${bin.binId}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setActiveUploads(prev => {
              if (!prev[uploadItem.id]) return prev;
              return {
                ...prev,
                [uploadItem.id]: { ...prev[uploadItem.id], progress: percentCompleted }
              };
            });
          }
        });

        // Mark as completed and remove from active list
        setActiveUploads(prev => {
          const updated = { ...prev };
          delete updated[uploadItem.id];
          return updated;
        });

        latestBin = response.data;
        setBin(latestBin);
      } catch (err) {
        console.error(err);
        // Mark as failed
        setActiveUploads(prev => {
          if (!prev[uploadItem.id]) return prev;
          return {
            ...prev,
            [uploadItem.id]: { ...prev[uploadItem.id], status: 'failed' }
          };
        });
        setError(err.response?.data?.error || `Failed to upload "${uploadItem.name}".`);
      }
    }

    setUploading(false);
  };

  // Delete file
  const handleDeleteFile = async (fileId) => {
    if (!bin?.binId) return;
    try {
      const response = await api.delete(`/bins/${bin.binId}/files/${fileId}`);
      setBin(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to delete the file.');
    }
  };

  // Destroy whole bin
  const handleDestroyBin = async () => {
    if (!bin?.binId) return;
    if (!window.confirm('Are you absolutely sure you want to permanently incinerate this bin and all its files?')) return;
    
    try {
      await api.delete(`/bins/${bin.binId}`);
      // Re-initialize with a new bin
      setLoading(true);
      const response = await api.post('/create-bin');
      setBin(response.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to destroy bin.');
    } finally {
      setLoading(false);
    }
  };

  // Format Helper
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FileIcon size={18} />;
    if (mimeType.startsWith('image/')) return <ImageIcon size={18} />;
    if (mimeType.startsWith('video/')) return <Video size={18} />;
    if (mimeType.startsWith('audio/')) return <Music size={18} />;
    if (mimeType.startsWith('text/')) return <FileText size={18} />;
    return <FileIcon size={18} />;
  };

  if (loading) {
    return (
      <div className="auth-page">
        <div style={{ textAlignment: 'center', color: 'var(--text-secondary)' }}>
          <Flame className="drag-drop-icon" size={48} style={{ margin: '0 auto 20px auto' }} />
          <h2 style={{ fontFamily: 'Syne' }}>Forging Secure Session Vault...</h2>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top Navbar */}
      <nav className="navbar">
        <Link to="/" className="navbar-logo">
          <span>UPLOADHUB</span>
        </Link>
        <div className="navbar-user-actions">
          <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
            {username}
          </span>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
            <LogOut size={14} /> Leave Portal
          </button>
        </div>
      </nav>

      <div className="upload-dashboard">
        {/* Left Side Bin Control */}
        <div className="bin-control-panel uh-card">
          <div className="bin-details-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
              <div>
                <span className="bin-header-label">ACTIVE BIN</span>
                <h2 className="bin-id-display mono" style={{ marginTop: '4px' }}>{bin?.binId}</h2>
              </div>
              {bin?.binId && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div className="qr-image-wrapper" style={{ padding: '6px', backgroundColor: '#faf5ef', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(getShareUrl())}`} 
                      alt="Scan to share bin" 
                      width="70"
                      height="70"
                    />
                  </div>
                  <span className="qr-label" style={{ fontSize: '10px', color: 'var(--accent-ash)', fontFamily: 'JetBrains Mono, monospace' }}>Scan to Share</span>
                </div>
              )}
            </div>

            <div className={`bin-expiry-display ${isNearingExpiry() ? 'pulsing' : ''}`}>
              <Clock size={18} className={isNearingExpiry() ? 'countdown-timer pulsing' : 'countdown-timer'} />
              <div>
                <span className="mono countdown-timer" style={{ fontSize: '15px' }}>{timeLeft}</span>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>before incineration</div>
              </div>
            </div>

            <div className="bin-divider"></div>

            <div className="share-link-group">
              <label className="bin-header-label">SHARE LINK</label>
              <div className="share-input-container">
                <input 
                  type="text" 
                  readOnly 
                  value={getShareUrl()} 
                  className="share-url-input"
                  onClick={(e) => e.target.select()}
                />
                <button 
                  onClick={handleCopy} 
                  className={`btn-copy ${copied ? 'copied' : ''}`}
                  title="Copy share link"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="bin-actions-section">
            <a 
              href={`/bin/${bin?.binId}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-secondary"
              style={{ width: '100%', gap: '8px' }}
            >
              Preview Public View <ExternalLink size={14} />
            </a>
            <button onClick={handleDestroyBin} className="btn-danger" style={{ width: '100%' }}>
              <Flame size={16} /> Incinerate Vault
            </button>
          </div>
        </div>

        {/* Right Side File Uploading Zone */}
        <div className="file-zone-panel">
          {error && <div className="auth-error" style={{ marginBottom: 0 }}>{error}</div>}

          {/* Drag & Drop Card */}
          <div 
            className={`drag-drop-zone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
            <Upload className="drag-drop-icon" size={36} />
            <div>
              <p className="drag-drop-text">Drop files here or click to browse</p>
              <p className="drag-drop-subtext">Secure, encrypted uploading to your active bin</p>
            </div>

            {/* Active Uploads Queue (Progress Bars) */}
            {Object.keys(activeUploads).length > 0 && (
              <div 
                className="upload-progress-container"
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', marginTop: '15px', cursor: 'default' }}
              >
                <div className="upload-progress-header">
                  <span>Vault Upload Queue</span>
                  <span>{Object.values(activeUploads).filter(u => u.status === 'uploading').length} active</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px', textAlign: 'left' }}>
                  {Object.values(activeUploads).map((upload) => (
                    <div key={upload.id} className="upload-progress-item">
                      <div className="upload-progress-item-info">
                        <span className="upload-progress-item-name" title={upload.name}>
                          {upload.name}
                        </span>
                        <span className="upload-progress-item-percent">
                          {upload.status === 'failed' ? (
                            <span style={{ color: '#ef4444' }}>Failed</span>
                          ) : upload.status === 'pending' ? (
                            <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                          ) : (
                            `${upload.progress}%`
                          )}
                        </span>
                      </div>
                      <div className="upload-progress-bar-bg">
                        <div 
                          className="upload-progress-bar-fill" 
                          style={{ 
                            width: `${upload.progress}%`,
                            backgroundColor: upload.status === 'failed' ? '#ef4444' : 'var(--accent-ember)'
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploading && Object.keys(activeUploads).length === 0 && (
              <span className="uh-badge" style={{ animation: 'pulse-warn 1s infinite' }}>
                Uploading to vault...
              </span>
            )}
          </div>

          {/* Files List Table */}
          <div className="file-table-container">
            {bin?.files && bin.files.length > 0 ? (
              <table className="file-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Size</th>
                    <th>Type</th>
                    <th>Uploaded</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bin.files.map((file) => (
                    <tr key={file._id} className="file-row">
                      <td className="file-name-cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {getFileIcon(file.type)}
                          <span title={file.fileName}>{file.fileName}</span>
                        </div>
                      </td>
                      <td className="file-size-cell">{formatBytes(file.size)}</td>
                      <td style={{ fontSize: '12px', opacity: 0.8 }}>{file.type || 'unknown'}</td>
                      <td className="file-uploaded-cell">
                        {new Date(file.uploadDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeleteFile(file._id)} 
                          className="btn-delete-file"
                          title="Incinerate file"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <FolderOpen className="empty-state-icon" size={32} />
                <p className="empty-state-text">No files yet. Start uploading.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UploadPage;
