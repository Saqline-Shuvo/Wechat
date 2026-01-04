
if (typeof firebase === 'undefined' || typeof auth === 'undefined') {
    console.error('Firebase not initialized! Check firebase-config.js');
    showAlert('Firebase configuration error. Please check console.', 'danger');
}

// Get DOM elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const alertContainer = document.getElementById('alertContainer');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

// Toggle between forms
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('d-none');
    registerForm.classList.remove('d-none');
    clearAlerts();
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('d-none');
    loginForm.classList.remove('d-none');
    clearAlerts();
});

// Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showAlert('Please fill in all fields', 'danger');
        return;
    }
    
    setLoading(loginBtn, 'loginSpinner', 'loginText', true);
    
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Check if user document exists, create if missing
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            const name = user.displayName || user.email.split('@')[0];
            await db.collection('users').doc(user.uid).set({
                uid: user.uid,
                name: name,
                email: user.email,
                displayName: name,
                avatar: generateAvatar(name),
                status: 'Hey there! I am using WeChat',
                online: true,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        showAlert(`Welcome back, ${user.displayName || 'User'}!`, 'success');
        loginForm.reset();
        
        console.log('User logged in:', user);
        
        // Redirect to chat page
        setTimeout(() => {
            window.location.replace('chat.html');
        }, 1000);
        
    } catch (error) {
        console.error('Login error:', error);
        handleAuthError(error);
    } finally {
        setLoading(loginBtn, 'loginSpinner', 'loginText', false);
    }
});

// Handle Registration
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
        showAlert('Please fill in all fields', 'danger');
        return;
    }
    
    if (password.length < 6) {
        showAlert('Password must be at least 6 characters long', 'danger');
        return;
    }
    
    if (password !== confirmPassword) {
        showAlert('Passwords do not match', 'danger');
        return;
    }
    
    setLoading(registerBtn, 'registerSpinner', 'registerText', true);
    
    try {
        // Create user account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update user profile with name
        await user.updateProfile({
            displayName: name
        });
        
        // Store user data in Firestore with online status
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            name: name,
            email: email,
            displayName: name,
            avatar: generateAvatar(name),
            status: 'Hey there! I am using WeChat',
            online: true,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showAlert('Account created successfully! Redirecting to chat...', 'success');
        registerForm.reset();
        
        // Redirect to chat page
        setTimeout(() => {
            window.location.replace('chat.html');
        }, 1500);
        
    } catch (error) {
        console.error('Registration error:', error);
        handleAuthError(error);
    } finally {
        setLoading(registerBtn, 'registerSpinner', 'registerText', false);
    }
});

// Check if user is already logged in
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log('User already logged in:', user);
        
        // Check if user document exists, create if not
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                // Create missing user document
                const name = user.displayName || user.email.split('@')[0];
                await db.collection('users').doc(user.uid).set({
                    uid: user.uid,
                    name: name,
                    email: user.email,
                    displayName: name,
                    avatar: generateAvatar(name),
                    status: 'Hey there! I am using WeChat',
                    online: true,
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Update online status
                await db.collection('users').doc(user.uid).update({
                    online: true,
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(err => console.log('Error updating status:', err));
            }
        } catch (error) {
            console.error('Error checking user document:', error);
        }
        
        // Redirect to chat
        window.location.replace('chat.html');
    }
});

// Generate simple avatar with initials
function generateAvatar(name) {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const colors = ['#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#FF9800', '#FF5722'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    return { initials, color };
}

// Handle Firebase authentication errors
function handleAuthError(error) {
    let message = 'An error occurred. Please try again.';
    
    switch (error.code) {
        case 'auth/email-already-in-use':
            message = 'This email is already registered';
            break;
        case 'auth/invalid-email':
            message = 'Invalid email address';
            break;
        case 'auth/weak-password':
            message = 'Password is too weak';
            break;
        case 'auth/user-not-found':
            message = 'No account found with this email';
            break;
        case 'auth/wrong-password':
            message = 'Incorrect password';
            break;
        case 'auth/too-many-requests':
            message = 'Too many failed attempts. Please try again later';
            break;
        case 'auth/network-request-failed':
            message = 'Network error. Please check your connection';
            break;
        default:
            message = error.message;
    }
    
    showAlert(message, 'danger');
}

// Show loading state on buttons
function setLoading(button, spinnerId, textId, isLoading) {
    const spinner = document.getElementById(spinnerId);
    const text = document.getElementById(textId);
    
    if (isLoading) {
        button.disabled = true;
        spinner.classList.remove('d-none');
        text.textContent = 'Please wait...';
    } else {
        button.disabled = false;
        spinner.classList.add('d-none');
        
        if (textId === 'loginText') text.textContent = 'Login';
        else if (textId === 'registerText') text.textContent = 'Sign Up';
    }
}

// Show alert message
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
    }, 5000);
}

// Clear all alerts
function clearAlerts() {
    alertContainer.innerHTML = '';
}

console.log('Auth.js loaded successfully');