import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Download, Copy, Check, Clock, Flame, ShieldAlert,
  FileText, Image as ImageIcon, Video, Music, File as FileIcon,
  FolderOpen
} from 'lucide-react';
import api from '../utils/api';
import '../styles/binview.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function BinView() {
  const { binId } = useParams();
  const [bin, setBin] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [copiedFileId, setCopiedFileId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');

  // Fetch bin metadata
  useEffect(() => {
    const fetchBin = async () => {
      try {
        const response = await api.get(`/bins/${binId}/public`);
        setBin(response.data);
        // Check if expired on initial load
        if (new Date() > new Date(response.data.expiresAt)) {
          setExpired(true);
        }
      } catch (err) {
        console.error(err);
        if (err.response?.status === 410 || err.response?.status === 404) {
          setExpired(true);
        } else {
          setError('Failed to fetch file share container details.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchBin();
  }, [binId]);

  // Countdown timer
  useEffect(() => {
    if (!bin?.expiresAt || expired) return;

    const updateTimer = () => {
      const difference = new Date(bin.expiresAt) - new Date();
      if (difference <= 0) {
        setExpired(true);
        setTimeLeft('Expired');
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
  }, [bin?.expiresAt, expired]);

  const handleCopyLink = (fileId) => {
    const downloadUrl = `${API_BASE_URL}/bins/${binId}/files/${fileId}/download`;
    navigator.clipboard.writeText(downloadUrl);
    setCopiedFileId(fileId);
    setTimeout(() => setCopiedFileId(null), 2000);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FileIcon size={20} />;
    if (mimeType.startsWith('image/')) return <ImageIcon size={20} />;
    if (mimeType.startsWith('video/')) return <Video size={20} />;
    if (mimeType.startsWith('audio/')) return <Music size={20} />;
    if (mimeType.startsWith('text/')) return <FileText size={20} />;
    return <FileIcon size={20} />;
  };

  if (loading) {
    return (
      <div className="auth-page">
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Flame className="drag-drop-icon" size={48} style={{ margin: '0 auto 20px auto' }} />
          <h2 style={{ fontFamily: 'Syne' }}>Reading Vault Signatures...</h2>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="auth-page">
        <div className="binview-expired">
          <div className="expired-icon">
            <ShieldAlert size={36} />
          </div>
          <h2 className="expired-title">Vault Expired</h2>
          <p className="expired-desc">
            This bin has expired and all files have been destroyed. 
            UploadHub unlinks physical disk files and purges database signatures immediately upon expiration.
          </p>
          <Link to="/" className="btn-primary" style={{ marginTop: '10px' }}>
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Navigation Header */}
      <nav className="navbar">
        <Link to="/" className="navbar-logo">
          <span>UPLOADHUB</span>
        </Link>
        <div>
          <Link to="/login" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
            Portal Access
          </Link>
        </div>
      </nav>

      <div className="binview-container">
        {error && <div className="auth-error">{error}</div>}

        <div className="binview-header">
          <span className="mono" style={{ fontSize: '13px', color: 'var(--accent-ash)', letterSpacing: '1px' }}>
            SECURE EPHEMERAL VAULT
          </span>
          <h1 className="binview-id mono">BIN / {binId}</h1>
          <div className="binview-expiry">
            <Clock size={15} style={{ color: 'var(--accent-warning)' }} />
            <span className="mono countdown-timer pulsing" style={{ color: 'var(--accent-warning)', fontWeight: 600 }}>
              {timeLeft} remaining
            </span>
          </div>
        </div>

        {bin?.files && bin.files.length > 0 ? (
          <div className="binview-grid">
            {bin.files.map((file) => (
              <div key={file._id} className="uh-card binview-file-card">
                <div className="file-card-top">
                  <div className="file-card-icon">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="file-card-details">
                    <h3 className="file-card-name" title={file.fileName}>
                      {file.fileName}
                    </h3>
                    <span className="file-card-meta">{formatBytes(file.size)}</span>
                    <span className="file-card-meta" style={{ fontSize: '11px', opacity: 0.7 }}>
                      {file.type || 'unknown'}
                    </span>
                  </div>
                </div>

                <div className="file-card-actions">
                  <a 
                    href={`${API_BASE_URL}/bins/${binId}/files/${file._id}/download`} 
                    download
                    className="btn-primary btn-card-action"
                    style={{ textDecoration: 'none' }}
                  >
                    <Download size={14} /> Download
                  </a>
                  <button 
                    onClick={() => handleCopyLink(file._id)} 
                    className="btn-secondary btn-card-action"
                    style={{ padding: '10px' }}
                    title="Copy direct download link"
                  >
                    {copiedFileId === file._id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="uh-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <FolderOpen size={32} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <p className="mono" style={{ color: 'var(--accent-ash)' }}>
              This bin is empty. No files reside in this vault.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BinView;
