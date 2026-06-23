import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ArrowRight, FolderPlus, Upload, Share2, ShieldCheck } from 'lucide-react';
import '../styles/home.css';

function Home() {
  const navigate = useNavigate();

  const handleEnterPortal = () => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/upload');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="home-container">
      {/* Left Panel: Hero Section */}
      <div className="home-left">
        <div className="home-logo-container">
          <span className="uh-badge">UploadHub</span>
        </div>

        <div className="home-hero-content">
          <h1 className="home-hero-heading">
            Temporary <span>vaults</span>.<br />
            Secure <span>delivery</span>.
          </h1>
          <p className="home-hero-subtext">
            Upload your documents, files, or archives into ephemeral vaults. 
            Share them securely with encrypted access. All contents automatically incinerate 
            after expiration, leaving absolutely no traces.
          </p>
          <button onClick={handleEnterPortal} className="btn-primary home-hero-cta">
            Enter Portal <ArrowRight size={18} />
          </button>
        </div>


      </div>

      {/* Right Panel: How it Works Grid */}
      <div className="home-right">
        <div className="home-grid">
          {/* Step 1 */}
          <div className="home-step-card">
            <div className="home-step-icon">
              <FolderPlus size={24} />
            </div>
            <h3 className="home-step-title">1. Sign In / Register</h3>
            <p className="home-step-desc">
              Create an account or login to access your secure personal file-sharing session.
            </p>
          </div>

          {/* Step 2 */}
          <div className="home-step-card">
            <div className="home-step-icon">
              <Upload size={24} />
            </div>
            <h3 className="home-step-title">2. Upload Files</h3>
            <p className="home-step-desc">
              Drag and drop your files. The dashboard lists uploaded filenames, file sizes, type, and dates.
            </p>
          </div>

          {/* Step 3 */}
          <div className="home-step-card">
            <div className="home-step-icon">
              <Share2 size={24} />
            </div>
            <h3 className="home-step-title">3. Share Link & QR</h3>
            <p className="home-step-desc">
              Copy the share URL or scan the auto-generated QR code to instantly distribute files.
            </p>
          </div>

          {/* Step 4 */}
          <div className="home-step-card">
            <div className="home-step-icon">
              <Flame size={24} />
            </div>
            <h3 className="home-step-title">4. Auto Destroyed</h3>
            <p className="home-step-desc">
              Once the active bin countdown timer hits zero, files are permanently erased from disk.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
