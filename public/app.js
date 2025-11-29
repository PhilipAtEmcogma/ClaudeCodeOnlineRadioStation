const audioPlayer = document.getElementById('audioPlayer');
const playButton = document.getElementById('playButton');
const volumeSlider = document.getElementById('volumeSlider');
const volumeIcon = document.getElementById('volumeIcon');
const statusDiv = document.getElementById('status');
const elapsedTimeDisplay = document.getElementById('elapsedTime');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const trackAlbum = document.getElementById('trackAlbum');
const sourceQuality = document.getElementById('sourceQuality');
const streamQuality = document.getElementById('streamQuality');
const yearBadge = document.getElementById('yearBadge');
const recentlyPlayedList = document.getElementById('recentlyPlayedList');
const albumArt = document.getElementById('albumArt');
const thumbsUpBtn = document.getElementById('thumbsUpBtn');
const thumbsDownBtn = document.getElementById('thumbsDownBtn');
const thumbsUpCount = document.getElementById('thumbsUpCount');
const thumbsDownCount = document.getElementById('thumbsDownCount');

const streamUrl = 'https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8';
const metadataUrl = 'https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json';

let isPlaying = false;
let hls = null;
let startTime = null;
let elapsedSeconds = 0;
let timerInterval = null;
let previousVolume = 70;
let metadataInterval = null;
let currentSongId = null;
let userSessionId = null;

// Generate browser fingerprint for persistent user identification
function generateFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Browser Fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Browser Fingerprint', 4, 17);
    const canvasData = canvas.toDataURL();

    const fingerprint = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        screenDepth: screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        canvas: canvasData,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory || 'unknown',
        plugins: Array.from(navigator.plugins || []).map(p => p.name).join(','),
        doNotTrack: navigator.doNotTrack,
        touchSupport: 'ontouchstart' in window
    };

    // Create hash from fingerprint
    const fpString = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < fpString.length; i++) {
        const char = fpString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    return 'fp_' + Math.abs(hash).toString(36);
}

// Get or create persistent session ID
function getSessionId() {
    // Try to get from localStorage first
    let sessionId = localStorage.getItem('radio_session_id');

    if (!sessionId) {
        // Generate fingerprint-based ID
        sessionId = generateFingerprint();
        try {
            localStorage.setItem('radio_session_id', sessionId);
        } catch (e) {
            // If localStorage fails, just use the fingerprint
            console.warn('localStorage not available, using fingerprint only');
        }
    }

    return sessionId;
}

userSessionId = getSessionId();

// Set initial volume
audioPlayer.volume = volumeSlider.value / 100;

// Initialize HLS
function initPlayer() {
    if (Hls.isSupported()) {
        hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(audioPlayer);

        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            console.log('HLS manifest loaded');
        });

        hls.on(Hls.Events.ERROR, function(event, data) {
            console.error('HLS error:', data);
            if (data.fatal) {
                switch(data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        updateStatus('Network error - retrying...', 'loading');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        updateStatus('Media error - recovering...', 'loading');
                        hls.recoverMediaError();
                        break;
                    default:
                        updateStatus('Fatal error - please refresh', 'stopped');
                        stopTimer();
                        hls.destroy();
                        break;
                }
            }
        });
    } else if (audioPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        audioPlayer.src = streamUrl;
    } else {
        alert('HLS is not supported in your browser');
    }
}

// Fetch metadata from server
async function fetchMetadata() {
    try {
        const response = await fetch(metadataUrl);
        if (!response.ok) throw new Error('Failed to fetch metadata');

        const data = await response.json();
        updateNowPlaying(data);
    } catch (error) {
        console.error('Error fetching metadata:', error);
    }
}

// Update now playing display
function updateNowPlaying(data) {
    // Update current track display
    trackArtist.textContent = data.artist || 'Unknown Artist';

    // Extract year from title if present (format: "Title (Year)")
    let title = data.title || 'Unknown Track';
    let year = '';
    const yearMatch = title.match(/\((\d{4})\)$/);
    if (yearMatch) {
        year = yearMatch[1];
        yearBadge.textContent = year;
    } else {
        yearBadge.style.display = 'none';
    }
    trackTitle.textContent = title;

    trackAlbum.textContent = data.album || '';

    // Update album art with cache-busting parameter
    albumArt.src = `https://d3d4yli4hf5bmh.cloudfront.net/cover.jpg?t=${Date.now()}`;

    // Create song ID from artist and title
    const newSongId = `${data.artist}-${data.title}`.replace(/[^a-zA-Z0-9-]/g, '_');

    // If song changed, reset rating buttons and fetch ratings
    if (currentSongId !== newSongId) {
        currentSongId = newSongId;
        fetchRatings();
    }

    // Update audio quality - always update with available data
    const bitDepth = data.bit_depth || 16;
    const sampleRate = data.sample_rate || 44100;

    // Update source quality (original file quality)
    sourceQuality.textContent = `Source quality: ${bitDepth}-bit ${(sampleRate / 1000).toFixed(1)}kHz`;

    // Update stream quality (how it's being delivered - typically upsampled to 48kHz)
    // The stream is always 48kHz FLAC/HLS Lossless regardless of source
    const streamSampleRate = 48; // kHz - our stream is always 48kHz
    const streamFormat = 'FLAC / HLS Lossless';
    streamQuality.textContent = `Stream quality: ${streamSampleRate}kHz ${streamFormat}`;

    // Update recently played from server data
    renderRecentlyPlayed(data);
}

// Render recently played tracks from server data
function renderRecentlyPlayed(data) {
    const recentTracks = [];

    // Build array from prev_* fields
    for (let i = 1; i <= 5; i++) {
        const artist = data[`prev_artist_${i}`];
        const title = data[`prev_title_${i}`];

        if (artist && title) {
            recentTracks.push({ artist, title });
        }
    }

    if (recentTracks.length === 0) {
        recentlyPlayedList.innerHTML = '<div class="empty-state">No recent tracks yet</div>';
        return;
    }

    recentlyPlayedList.innerHTML = recentTracks.map(track => `
        <div class="track-item">
            <span class="artist">${track.artist}:</span> <span class="title">${track.title}</span>
        </div>
    `).join('');
}

// Fetch ratings for current song
async function fetchRatings() {
    if (!currentSongId) return;

    try {
        const response = await fetch(`/api/ratings/${currentSongId}?session_id=${userSessionId}`);
        if (!response.ok) throw new Error('Failed to fetch ratings');

        const data = await response.json();
        updateRatingDisplay(data);
    } catch (error) {
        console.error('Error fetching ratings:', error);
    }
}

// Update rating display
function updateRatingDisplay(data) {
    thumbsUpCount.textContent = data.thumbs_up || 0;
    thumbsDownCount.textContent = data.thumbs_down || 0;

    // Reset button states - keep them enabled so users can change their mind
    thumbsUpBtn.classList.remove('active');
    thumbsDownBtn.classList.remove('active');
    thumbsUpBtn.disabled = false;
    thumbsDownBtn.disabled = false;

    // Mark user's previous rating if exists (but keep buttons enabled)
    if (data.user_rating === 1) {
        thumbsUpBtn.classList.add('active');
    } else if (data.user_rating === -1) {
        thumbsDownBtn.classList.add('active');
    }
}

// Submit rating
async function submitRating(rating) {
    if (!currentSongId) return;

    try {
        const response = await fetch('/api/ratings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                song_id: currentSongId,
                session_id: userSessionId,
                rating: rating
            })
        });

        if (!response.ok) throw new Error('Failed to submit rating');

        const data = await response.json();

        // Update display with new counts
        thumbsUpCount.textContent = data.thumbs_up || 0;
        thumbsDownCount.textContent = data.thumbs_down || 0;

        // Mark active button but keep both enabled so users can change their vote
        thumbsUpBtn.classList.remove('active');
        thumbsDownBtn.classList.remove('active');

        if (rating === 1) {
            thumbsUpBtn.classList.add('active');
        } else {
            thumbsDownBtn.classList.add('active');
        }

        // Keep buttons enabled so users can change their vote
        thumbsUpBtn.disabled = false;
        thumbsDownBtn.disabled = false;
    } catch (error) {
        console.error('Error submitting rating:', error);
        alert('Failed to submit rating');
    }
}

// Rating button event listeners
thumbsUpBtn.addEventListener('click', () => submitRating(1));
thumbsDownBtn.addEventListener('click', () => submitRating(-1));

// Start fetching metadata
function startMetadataFetch() {
    // Fetch immediately
    fetchMetadata();

    // Then fetch every 5 seconds
    if (!metadataInterval) {
        metadataInterval = setInterval(fetchMetadata, 5000);
    }
}

// Stop fetching metadata
function stopMetadataFetch() {
    if (metadataInterval) {
        clearInterval(metadataInterval);
        metadataInterval = null;
    }
}

// Format time as m:ss / Live
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')} / Live`;
}

// Update elapsed time display
function updateElapsedTime() {
    if (isPlaying && startTime) {
        const now = Date.now();
        elapsedSeconds = Math.floor((now - startTime) / 1000);
        elapsedTimeDisplay.textContent = formatTime(elapsedSeconds);
    }
}

// Start timer
function startTimer() {
    if (!timerInterval) {
        startTime = Date.now() - (elapsedSeconds * 1000);
        timerInterval = setInterval(updateElapsedTime, 1000);
        updateElapsedTime();
    }
}

// Stop timer
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Reset timer
function resetTimer() {
    stopTimer();
    elapsedSeconds = 0;
    startTime = null;
    elapsedTimeDisplay.textContent = '0:00 / Live';
}

// Play/Pause functionality
playButton.addEventListener('click', function() {
    if (!hls && Hls.isSupported()) {
        initPlayer();
    }

    if (!isPlaying) {
        audioPlayer.play()
            .then(() => {
                isPlaying = true;
                playButton.textContent = '⏸';
                updateStatus('Playing', 'playing');
                startTimer();
                startMetadataFetch();
            })
            .catch(error => {
                console.error('Play error:', error);
                updateStatus('Error playing stream', 'stopped');
            });
    } else {
        audioPlayer.pause();
        isPlaying = false;
        playButton.textContent = '▶';
        updateStatus('Paused', 'stopped');
        stopTimer();
        stopMetadataFetch();
    }
});

// Volume control
volumeSlider.addEventListener('input', function() {
    const volume = this.value;
    audioPlayer.volume = volume / 100;

    // Update volume icon
    if (volume == 0) {
        volumeIcon.textContent = '🔇';
    } else if (volume < 50) {
        volumeIcon.textContent = '🔉';
    } else {
        volumeIcon.textContent = '🔊';
    }

    if (volume > 0) {
        previousVolume = volume;
    }
});

// Click volume icon to mute/unmute
volumeIcon.addEventListener('click', function() {
    if (volumeSlider.value > 0) {
        previousVolume = volumeSlider.value;
        volumeSlider.value = 0;
    } else {
        volumeSlider.value = previousVolume;
    }
    volumeSlider.dispatchEvent(new Event('input'));
});

// Audio events
audioPlayer.addEventListener('waiting', function() {
    updateStatus('Buffering...', 'loading');
});

audioPlayer.addEventListener('playing', function() {
    updateStatus('Playing', 'playing');
});

audioPlayer.addEventListener('pause', function() {
    if (isPlaying) {
        updateStatus('Paused', 'stopped');
    }
});

audioPlayer.addEventListener('ended', function() {
    isPlaying = false;
    playButton.textContent = '▶';
    updateStatus('Stopped', 'stopped');
    resetTimer();
    stopMetadataFetch();
});

// Update status display
function updateStatus(message, state) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + state;
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    stopTimer();
    stopMetadataFetch();
    if (hls) {
        hls.destroy();
    }
});

// Fetch metadata once on page load to show current track
fetchMetadata();
