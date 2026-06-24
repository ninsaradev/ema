// ==================== CONFIGURATION ====================
const CONFIG = {
    // PUT YOUR BASE64-ENCODED GITHUB PAT TOKEN HERE
    GITHUB_PAT_BASE64: 'PUT_YOUR_BASE64_ENCODED_PAT_HERE',
    GITHUB_OWNER: 'ninsaradev',
    GITHUB_REPO: 'ema-backed',
    GITHUB_BRANCH: 'main',
    TEXTLK_BEARER: '2978|LJtLlcBp7kBtuwPflj9rgkFSB4nb9FQIVMgNhOU918611bc8',
    TEXTLK_SENDER_ID: 'TextLKDemo'
};

// ==================== UTILITY FUNCTIONS ====================
function decodeBase64(str) {
    try {
        return atob(str);
    } catch (e) {
        console.error('Failed to decode base64:', e);
        return '';
    }
}

function getGithubToken() {
    return decodeBase64(CONFIG.GITHUB_PAT_BASE64);
}

function generateEmaId() {
    const digits = Math.floor(100000 + Math.random() * 900000).toString();
    return digits + '-E';
}

function generateOtp() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showPopup(popupId) {
    document.getElementById(popupId).classList.add('show');
}

function hidePopup(popupId) {
    document.getElementById(popupId).classList.remove('show');
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function compressImage(file, maxSizeKB = 50) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale down
                const maxDim = 400;
                if (width > maxDim || height > maxDim) {
                    const ratio = Math.min(maxDim / width, maxDim / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.7;
                let result = canvas.toDataURL('image/jpeg', quality);

                // Reduce quality until under maxSizeKB
                while (result.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
                    quality -= 0.05;
                    result = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(result);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ==================== GITHUB API ====================
async function saveToGithub(emaId, data) {
    const token = getGithubToken();
    const path = `user/user_${emaId}_data.json`;
    const url = `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${path}`;

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

    // Check if file exists
    let sha = null;
    try {
        const checkResp = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (checkResp.ok) {
            const existing = await checkResp.json();
            sha = existing.sha;
        }
    } catch (e) { }

    const body = {
        message: `Add user data for ${emaId}`,
        content: content,
        branch: CONFIG.GITHUB_BRANCH
    };
    if (sha) body.sha = sha;

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to save data');
    }

    return await response.json();
}

async function loadUserFromGithub(emaId) {
    const token = getGithubToken();
    const path = `user/user_${emaId}_data.json`;
    const url = `https://raw.githubusercontent.com/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/${CONFIG.GITHUB_BRANCH}/${path}`;

    const response = await fetch(url, {
        headers: token ? { 'Authorization': `token ${token}` } : {},
        cache: 'no-store'
    });

    if (!response.ok) return null;

    const text = await response.text();
    return JSON.parse(text);
}

async function findUserByPhone(phoneNumber) {
    const token = getGithubToken();
    // List files in user directory
    const url = `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/user`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) return null;

    const files = await response.json();

    for (const file of files) {
        if (file.name.endsWith('_data.json')) {
            try {
                const rawUrl = file.download_url;
                const fileResp = await fetch(rawUrl, { cache: 'no-store' });
                if (fileResp.ok) {
                    const userData = await fileResp.json();
                    if (userData.phone === phoneNumber) {
                        return userData;
                    }
                }
            } catch (e) {
                continue;
            }
        }
    }

    return null;
}

// ==================== SMS API ====================
async function sendSms(phoneNumber, message) {
    // Format phone number for Sri Lanka
    let formatted = phoneNumber.replace(/\s/g, '');
    if (formatted.startsWith('0')) {
        formatted = '94' + formatted.substring(1);
    } else if (!formatted.startsWith('94')) {
        formatted = '94' + formatted;
    }

    try {
        const response = await fetch('https://app.text.lk/api/v3/sms/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.TEXTLK_BEARER}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                recipient: formatted,
                sender_id: CONFIG.TEXTLK_SENDER_ID,
                type: 'plain',
                message: message
            })
        });
        return response.ok;
    } catch (e) {
        console.error('SMS send failed:', e);
        // For demo, return true even if CORS blocks it
        return true;
    }
}

// ==================== ID CARD GENERATION ====================
async function generateIdCard(userData) {
    const canvas = document.getElementById('idCardCanvas');
    const ctx = canvas.getContext('2d');
    const W = 1920;
    const H = 1080;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Header bar
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(0, 0, W, 180);

    // Header text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 56px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EMA - Elephant Monitoring App', W / 2, 80);
    ctx.font = '32px Segoe UI, sans-serif';
    ctx.fillText('අලි නිරීක්ෂණ යෙදුම - හැඳුනුම්පත', W / 2, 140);

    // Card border
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 200, W - 40, H - 220);

    // Profile picture
    if (userData.profilePic) {
        try {
            const img = await loadImageFromBase64(userData.profilePic);
            // Draw circular profile picture
            ctx.save();
            ctx.beginPath();
            ctx.arc(280, 480, 150, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, 130, 330, 300, 300);
            ctx.restore();

            // Circle border
            ctx.beginPath();
            ctx.arc(280, 480, 152, 0, Math.PI * 2);
            ctx.strokeStyle = '#2E7D32';
            ctx.lineWidth = 4;
            ctx.stroke();
        } catch (e) {
            // Draw placeholder
            ctx.beginPath();
            ctx.arc(280, 480, 150, 0, Math.PI * 2);
            ctx.fillStyle = '#E8F5E9';
            ctx.fill();
            ctx.strokeStyle = '#2E7D32';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.fillStyle = '#2E7D32';
            ctx.font = '80px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('👤', 280, 505);
        }
    }

    // User details
    ctx.textAlign = 'left';
    const detailsX = 500;
    let detailsY = 320;

    // Name
    ctx.fillStyle = '#757575';
    ctx.font = '24px Segoe UI, sans-serif';
    ctx.fillText('සම්පූර්ණ නම / Full Name', detailsX, detailsY);
    detailsY += 45;
    ctx.fillStyle = '#212121';
    ctx.font = 'bold 40px Segoe UI, sans-serif';
    ctx.fillText(userData.fullName || 'N/A', detailsX, detailsY);

    // EMA ID
    detailsY += 70;
    ctx.fillStyle = '#757575';
    ctx.font = '24px Segoe UI, sans-serif';
    ctx.fillText('EMA හැඳුනුම්පත් අංකය / EMA ID', detailsX, detailsY);
    detailsY += 50;
    ctx.fillStyle = '#2E7D32';
    ctx.font = 'bold 52px Segoe UI, sans-serif';
    ctx.fillText(userData.emaId || 'N/A', detailsX, detailsY);

    // Phone
    detailsY += 70;
    ctx.fillStyle = '#757575';
    ctx.font = '24px Segoe UI, sans-serif';
    ctx.fillText('දුරකථන අංකය / Phone Number', detailsX, detailsY);
    detailsY += 45;
    ctx.fillStyle = '#212121';
    ctx.font = 'bold 36px Segoe UI, sans-serif';
    ctx.fillText('+94 ' + (userData.phone || 'N/A'), detailsX, detailsY);

    // Email
    if (userData.email) {
        detailsY += 70;
        ctx.fillStyle = '#757575';
        ctx.font = '24px Segoe UI, sans-serif';
        ctx.fillText('විද්‍යුත් තැපෑල / Email', detailsX, detailsY);
        detailsY += 45;
        ctx.fillStyle = '#212121';
        ctx.font = 'bold 32px Segoe UI, sans-serif';
        ctx.fillText(userData.email, detailsX, detailsY);
    }

    // QR Code
    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = '';
    const qrDiv = document.createElement('div');
    qrContainer.appendChild(qrDiv);

    await new Promise((resolve) => {
        new QRCode(qrDiv, {
            text: userData.emaId,
            width: 250,
            height: 250,
            colorDark: '#2E7D32',
            colorLight: '#FFFFFF',
            correctLevel: QRCode.CorrectLevel.H
        });
        setTimeout(resolve, 500);
    });

    const qrCanvas = qrDiv.querySelector('canvas');
    if (qrCanvas) {
        const qrX = W - 350;
        const qrY = H - 380;

        // QR background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(qrX - 20, qrY - 20, 290, 290);
        ctx.strokeStyle = '#2E7D32';
        ctx.lineWidth = 2;
        ctx.strokeRect(qrX - 20, qrY - 20, 290, 290);

        ctx.drawImage(qrCanvas, qrX, qrY, 250, 250);

        ctx.fillStyle = '#757575';
        ctx.font = '18px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('QR Code / QR කේතය', qrX + 125, qrY + 280);
    }

    // Footer
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(0, H - 60, W, 60);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '22px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EMA - Elephant Monitoring App | අලි නිරීක්ෂණ යෙදුම', W / 2, H - 22);

    // Registered date
    ctx.textAlign = 'left';
    ctx.fillStyle = '#757575';
    ctx.font = '20px Segoe UI, sans-serif';
    const dateStr = new Date().toLocaleDateString('si-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    ctx.fillText('ලියාපදිංචි දිනය / Date: ' + dateStr, 60, H - 90);

    // Download
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `EMA_ID_Card_${userData.emaId}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            resolve();
        }, 'image/png');
    });
}

function loadImageFromBase64(base64) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = base64;
    });
}

// ==================== QR SCANNER ====================
let scannerStream = null;
let scannerInterval = null;

async function startScanner() {
    const video = document.getElementById('scannerVideo');
    const canvas = document.getElementById('scannerCanvas');

    try {
        scannerStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = scannerStream;
        await video.play();

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        scannerInterval = setInterval(() => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                if (typeof jsQR !== 'undefined') {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code && code.data) {
                        const scannedId = code.data.trim();
                        if (/^\d{6}-E$/.test(scannedId)) {
                            stopScanner();
                            hidePopup('eCardPopup');
                            loginWithId(scannedId);
                        }
                    }
                }
            }
        }, 200);
    } catch (e) {
        console.error('Camera error:', e);
        showToast('කැමරාව විවෘත කිරීමට නොහැකි විය / Cannot access camera');
    }
}

function stopScanner() {
    if (scannerInterval) {
        clearInterval(scannerInterval);
        scannerInterval = null;
    }
    if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop());
        scannerStream = null;
    }
}

// ==================== LOGIN FUNCTIONS ====================
async function loginWithId(emaId) {
    showLoading();
    try {
        const userData = await loadUserFromGithub(emaId);
        if (userData) {
            localStorage.setItem('ema_user', JSON.stringify(userData));
            localStorage.setItem('ema_id', emaId);
            hideLoading();
            window.location.href = 'main.html';
        } else {
            hideLoading();
            showToast('EMA ID සොයාගත නොහැක / EMA ID not found');
        }
    } catch (e) {
        hideLoading();
        showToast('දෝෂයකි. නැවත උත්සාහ කරන්න / Error. Please try again');
        console.error(e);
    }
}

// ==================== APP STATE ====================
let currentStep = 0;
let profilePicBase64 = null;
let currentOtp = null;
let foundUserData = null;

// ==================== SPLASH SCREEN ====================
function initSplash() {
    const fill = document.querySelector('.loader-fill');
    let progress = 0;

    const interval = setInterval(() => {
        progress += Math.random() * 8 + 2;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);

            setTimeout(() => {
                // Check localStorage
                const userData = localStorage.getItem('ema_user');
                if (userData) {
                    window.location.href = 'main.html';
                } else {
                    showScreen('loginScreen');
                }
            }, 500);
        }
        fill.style.width = progress + '%';
    }, 100);
}

// ==================== CAROUSEL ====================
function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.carousel-slide').forEach(s => s.classList.remove('active'));
    document.querySelector(`.carousel-slide[data-step="${step}"]`).classList.add('active');

    document.querySelectorAll('.indicator').forEach((ind, i) => {
        ind.classList.remove('active', 'completed');
        if (i === step) ind.classList.add('active');
        else if (i < step) ind.classList.add('completed');
    });
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    initSplash();

    // Login button
    document.getElementById('loginBtn').addEventListener('click', () => {
        const emaId = document.getElementById('emaIdInput').value.trim();
        if (!emaId) {
            showToast('කරුණාකර EMA ID ඇතුළත් කරන්න / Please enter EMA ID');
            return;
        }
        if (!/^\d{6}-E$/.test(emaId)) {
            showToast('වලංගු EMA ID ආකෘතිය: 123456-E / Valid format: 123456-E');
            return;
        }
        loginWithId(emaId);
    });

    // Sign up button
    document.getElementById('signUpBtn').addEventListener('click', () => {
        showScreen('signUpScreen');
        goToStep(0);
    });

    // Back to login
    document.getElementById('backToLogin').addEventListener('click', () => {
        showScreen('loginScreen');
    });

    // Carousel navigation
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextStep = parseInt(btn.dataset.next);

            // Validation
            if (currentStep === 0) {
                const name = document.getElementById('fullName').value.trim();
                if (!name) {
                    showToast('කරුණාකර ඔබගේ නම ඇතුළත් කරන්න / Please enter your name');
                    return;
                }
            } else if (currentStep === 1) {
                if (!profilePicBase64) {
                    showToast('කරුණාකර පැතිකඩ පින්තූරයක් තෝරන්න / Please choose a profile picture');
                    return;
                }
            } else if (currentStep === 2) {
                const phone = document.getElementById('phoneNumber').value.trim();
                if (!phone || phone.length < 9) {
                    showToast('කරුණාකර වලංගු දුරකථන අංකයක් ඇතුළත් කරන්න / Please enter a valid phone number');
                    return;
                }
            }

            goToStep(nextStep);
        });
    });

    document.querySelectorAll('.btn-prev').forEach(btn => {
        btn.addEventListener('click', () => {
            goToStep(parseInt(btn.dataset.prev));
        });
    });

    // Indicators click
    document.querySelectorAll('.indicator').forEach(ind => {
        ind.addEventListener('click', () => {
            const step = parseInt(ind.dataset.step);
            if (step <= currentStep) goToStep(step);
        });
    });

    // Profile picture upload
    document.getElementById('uploadPicBtn').addEventListener('click', () => {
        document.getElementById('profilePicInput').click();
    });

    document.getElementById('profilePreview').addEventListener('click', () => {
        document.getElementById('profilePicInput').click();
    });

    document.getElementById('profilePicInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                profilePicBase64 = await compressImage(file, 50);
                const preview = document.getElementById('profilePreview');
                preview.innerHTML = `<img src="${profilePicBase64}" alt="Profile">`;
            } catch (err) {
                showToast('පින්තූරය පූරණය කිරීමට නොහැකි විය / Failed to load image');
            }
        }
    });

    // Submit sign up
    document.getElementById('submitSignUp').addEventListener('click', async () => {
        const fullName = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phoneNumber').value.trim();
        const email = document.getElementById('emailAddress').value.trim();

        if (!fullName) {
            showToast('කරුණාකර ඔබගේ නම ඇතුළත් කරන්න / Please enter your name');
            goToStep(0);
            return;
        }
        if (!profilePicBase64) {
            showToast('කරුණාකර පැතිකඩ පින්තූරයක් තෝරන්න / Please choose a profile picture');
            goToStep(1);
            return;
        }
        if (!phone || phone.length < 9) {
            showToast('කරුණාකර වලංගු දුරකථන අංකයක් ඇතුළත් කරන්න / Please enter valid phone number');
            goToStep(2);
            return;
        }

        const emaId = generateEmaId();

        const userData = {
            emaId: emaId,
            fullName: fullName,
            phone: phone,
            email: email || '',
            profilePic: profilePicBase64,
            registeredAt: new Date().toISOString()
        };

        showLoading();

        try {
            await saveToGithub(emaId, userData);
            hideLoading();

            // Show success popup
            document.getElementById('newEmaId').textContent = emaId;
            showPopup('successPopup');

            // Generate and download ID card
            document.getElementById('cardDownloadStatus').textContent = 'E-Card සකසමින්... / Generating E-Card...';
            document.getElementById('doneBtn').classList.add('hidden');

            setTimeout(async () => {
                try {
                    await generateIdCard(userData);
                    document.getElementById('cardDownloadStatus').textContent = 'E-Card සාර්ථකව බාගත විය! / E-Card downloaded!';
                } catch (err) {
                    document.getElementById('cardDownloadStatus').textContent = 'E-Card බාගත කිරීමට නොහැකි විය / E-Card download failed';
                    console.error('ID Card generation error:', err);
                }
                document.getElementById('doneBtn').classList.remove('hidden');
            }, 1000);

            // Store user data reference (without large profile pic for localStorage efficiency)
            const storageData = { ...userData };
            // Keep profilePic in storage for future use
            window._pendingUserData = storageData;

        } catch (err) {
            hideLoading();
            console.error('Sign up error:', err);
            showToast('ලියාපදිංචි වීමට නොහැකි විය. නැවත උත්සාහ කරන්න / Registration failed. Please try again.');
        }
    });

    // Done button
    document.getElementById('doneBtn').addEventListener('click', () => {
        hidePopup('successPopup');
        if (window._pendingUserData) {
            localStorage.setItem('ema_user', JSON.stringify(window._pendingUserData));
            localStorage.setItem('ema_id', window._pendingUserData.emaId);
        }
        window.location.href = 'main.html';
    });

    // Forgot ID
    document.getElementById('forgotIdBtn').addEventListener('click', () => {
        // Reset forgot popup state
        document.getElementById('forgotStep1').classList.remove('hidden');
        document.getElementById('forgotStep2').classList.add('hidden');
        document.getElementById('forgotStep3').classList.add('hidden');
        document.getElementById('forgotError').classList.add('hidden');
        document.getElementById('forgotLoading').classList.add('hidden');
        document.getElementById('forgotPhone').value = '';
        document.querySelectorAll('.otp-box').forEach(b => b.value = '');
        showPopup('forgotIdPopup');
    });

    document.getElementById('closeForgotPopup').addEventListener('click', () => {
        hidePopup('forgotIdPopup');
    });

    // Send OTP
    document.getElementById('sendOtpBtn').addEventListener('click', async () => {
        const phone = document.getElementById('forgotPhone').value.trim();
        if (!phone || phone.length < 9) {
            document.getElementById('forgotError').textContent = 'කරුණාකර වලංගු දුරකථන අංකයක් ඇතුළත් කරන්න / Enter a valid phone number';
            document.getElementById('forgotError').classList.remove('hidden');
            return;
        }

        document.getElementById('forgotError').classList.add('hidden');
        document.getElementById('forgotLoading').classList.remove('hidden');
        document.getElementById('forgotStep1').style.pointerEvents = 'none';

        try {
            foundUserData = await findUserByPhone(phone);

            if (!foundUserData) {
                document.getElementById('forgotLoading').classList.add('hidden');
                document.getElementById('forgotStep1').style.pointerEvents = 'auto';
                document.getElementById('forgotError').textContent = 'මෙම දුරකථන අංකය සොයාගත නොහැක / No such mobile number found';
                document.getElementById('forgotError').classList.remove('hidden');
                return;
            }

            // Generate and send OTP
            currentOtp = generateOtp();
            const message = `Your EMA OTP is ${currentOtp}`;

            await sendSms(phone, message);

            document.getElementById('forgotLoading').classList.add('hidden');
            document.getElementById('forgotStep1').classList.add('hidden');
            document.getElementById('forgotStep2').classList.remove('hidden');

            // Focus first OTP box
            document.querySelector('.otp-box[data-index="0"]').focus();

        } catch (err) {
            document.getElementById('forgotLoading').classList.add('hidden');
            document.getElementById('forgotStep1').style.pointerEvents = 'auto';
            document.getElementById('forgotError').textContent = 'දෝෂයකි. නැවත උත්සාහ කරන්න / Error. Please try again';
            document.getElementById('forgotError').classList.remove('hidden');
            console.error(err);
        }
    });

    // OTP boxes auto-focus
    document.querySelectorAll('.otp-box').forEach((box, index) => {
        box.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length === 1 && index < 3) {
                document.querySelector(`.otp-box[data-index="${index + 1}"]`).focus();
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                document.querySelector(`.otp-box[data-index="${index - 1}"]`).focus();
            }
        });
    });

    // Verify OTP
    document.getElementById('verifyOtpBtn').addEventListener('click', () => {
        const enteredOtp = Array.from(document.querySelectorAll('.otp-box'))
            .map(b => b.value).join('');

        if (enteredOtp.length !== 4) {
            showToast('කරුණාකර OTP අංක 4 ඇතුළත් කරන්න / Please enter all 4 OTP digits');
            return;
        }

        if (enteredOtp === currentOtp) {
            document.getElementById('forgotStep2').classList.add('hidden');
            document.getElementById('foundEmaId').textContent = foundUserData.emaId;
            document.getElementById('forgotStep3').classList.remove('hidden');
        } else {
            showToast('OTP වැරදියි. නැවත උත්සාහ කරන්න / Incorrect OTP. Try again');
            document.querySelectorAll('.otp-box').forEach(b => b.value = '');
            document.querySelector('.otp-box[data-index="0"]').focus();
        }
    });

    // Use found ID to login
    document.getElementById('useFoundId').addEventListener('click', () => {
        hidePopup('forgotIdPopup');
        if (foundUserData) {
            loginWithId(foundUserData.emaId);
        }
    });

    // E-Card Scanner
    document.getElementById('eCardBtn').addEventListener('click', () => {
        showPopup('eCardPopup');
        startScanner();
    });

    document.getElementById('closeECardPopup').addEventListener('click', () => {
        stopScanner();
        hidePopup('eCardPopup');
    });

    // Allow Enter key on login
    document.getElementById('emaIdInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('loginBtn').click();
        }
    });
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    stopScanner();
});
