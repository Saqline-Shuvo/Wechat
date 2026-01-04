// Global variables
let currentUser = null;
let selectedUser = null;
let currentConversationId = null;
let unsubscribeMessages = null;

// DOM elements
const usersList = document.getElementById('usersList');
const currentUserName = document.getElementById('currentUserName');
const currentUserStatus = document.getElementById('currentUserStatus');
const currentUserAvatar = document.getElementById('currentUserAvatar');
const currentUserInitials = document.getElementById('currentUserInitials');
const logoutBtn = document.getElementById('logoutBtn');
const searchUsers = document.getElementById('searchUsers');
const noChatSelected = document.getElementById('noChatSelected');
const activeChat = document.getElementById('activeChat');
const messagesArea = document.getElementById('messagesArea');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatUserName = document.getElementById('chatUserName');
const chatUserStatus = document.getElementById('chatUserStatus');
const chatUserAvatar = document.getElementById('chatUserAvatar');
const chatUserInitials = document.getElementById('chatUserInitials');
const backBtn = document.getElementById('backBtn');
const sidebar = document.getElementById('sidebar');

// Check authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        console.log('User logged in:', user.email);
        
        // Update UI with current user info
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            currentUserName.textContent = userData.name || user.displayName || 'User';
            currentUserStatus.textContent = 'Online';
            
            // Set avatar
            if (userData.avatar) {
                currentUserAvatar.style.backgroundColor = userData.avatar.color;
                currentUserInitials.textContent = userData.avatar.initials;
            }
            
            // Update online status
            await db.collection('users').doc(user.uid).update({
                online: true,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Load all users
        loadUsers();
        
    } else {
        console.log('No user logged in');
        window.location.replace('index.html');
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
        try {
            // Update online status
            if (currentUser) {
                await db.collection('users').doc(currentUser.uid).update({
                    online: false,
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            await auth.signOut();
            window.location.replace('index.html');
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out: ' + error.message);
        }
    }
});

// Load all users
function loadUsers() {
    db.collection('users')
        .orderBy('name')
        .onSnapshot((snapshot) => {
            usersList.innerHTML = '';
            
            const users = [];
            snapshot.forEach((doc) => {
                const userData = doc.data();
                if (doc.id !== currentUser.uid) { // Don't show current user
                    users.push({ id: doc.id, ...userData });
                }
            });
            
            if (users.length === 0) {
                usersList.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <p>No other users yet</p>
                        <p>Invite friends to join!</p>
                    </div>
                `;
                return;
            }
            
            users.forEach(user => {
                const userItem = createUserItem(user);
                usersList.appendChild(userItem);
            });
        }, (error) => {
            console.error('Error loading users:', error);
            usersList.innerHTML = `
                <div class="text-center text-muted py-5">
                    <p>Error loading users</p>
                    <p>${error.message}</p>
                </div>
            `;
        });
}

// Create user item element
function createUserItem(user) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.dataset.userId = user.id;
    
    const onlineStatus = user.online ? '<span class="online-indicator"></span>' : '';
    const statusText = user.online ? 'online' : 'offline';
    
    div.innerHTML = `
        <div class="user-avatar me-3" style="background-color: ${user.avatar?.color || '#128C7E'}">
            <span>${user.avatar?.initials || user.name?.substring(0, 2).toUpperCase() || 'U'}</span>
        </div>
        <div class="user-item-info">
            <div class="user-item-name">${user.name || user.email}</div>
            <div class="user-item-status">${onlineStatus}${statusText}</div>
        </div>
    `;
    
    div.addEventListener('click', () => openChat(user));
    
    return div;
}

// Open chat with selected user
async function openChat(user) {
    selectedUser = user;
    
    // Update active state
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-user-id="${user.id}"]`)?.classList.add('active');
    
    // Show chat area
    noChatSelected.classList.add('d-none');
    activeChat.classList.remove('d-none');
    
    // Hide sidebar on mobile
    if (window.innerWidth <= 768) {
        sidebar.classList.add('hidden');
    }
    
    // Update chat header
    chatUserName.textContent = user.name || user.email;
    chatUserStatus.textContent = user.online ? 'online' : 'offline';
    
    if (user.avatar) {
        chatUserAvatar.style.backgroundColor = user.avatar.color;
        chatUserInitials.textContent = user.avatar.initials;
    }
    
    // Get or create conversation
    currentConversationId = await getOrCreateConversation(user.id);
    
    // Load messages
    loadMessages(currentConversationId);
    
    // Focus input
    messageInput.focus();
}

// Get or create conversation between two users
async function getOrCreateConversation(otherUserId) {
    const participants = [currentUser.uid, otherUserId].sort();
    const conversationId = participants.join('_');
    
    const conversationRef = db.collection('conversations').doc(conversationId);
    const conversationDoc = await conversationRef.get();
    
    if (!conversationDoc.exists) {
        // Create new conversation
        await conversationRef.set({
            participants: participants,
            participantsData: {
                [currentUser.uid]: {
                    name: currentUser.displayName || currentUser.email,
                    email: currentUser.email
                },
                [otherUserId]: {
                    name: selectedUser.name || selectedUser.email,
                    email: selectedUser.email
                }
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessage: null,
            lastMessageTime: null
        });
    }
    
    return conversationId;
}

// Load messages for conversation
function loadMessages(conversationId) {
    // Unsubscribe from previous conversation
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }
    
    messagesArea.innerHTML = '<div class="text-center text-muted py-5"><p>Loading messages...</p></div>';
    
    // Listen to messages
    unsubscribeMessages = db.collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            messagesArea.innerHTML = '';
            
            if (snapshot.empty) {
                messagesArea.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <p style="color: #A27B5C;">No messages yet</p>
                        <p style="color: #A27B5C;">Say hi to start the conversation!</p>
                    </div>
                `;
                return;
            }
            
            snapshot.forEach((doc) => {
                const message = doc.data();
                displayMessage(message);
            });
            
            scrollToBottom();
        }, (error) => {
            console.error('Error loading messages:', error);
            messagesArea.innerHTML = `
                <div class="text-center text-muted py-5">
                    <p>Error loading messages</p>
                </div>
            `;
        });
}

// Display a message
function displayMessage(message) {
    const div = document.createElement('div');
    const isSent = message.senderId === currentUser.uid;
    
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = message.timestamp 
        ? formatTime(message.timestamp.toDate()) 
        : formatTime(new Date());
    
    div.innerHTML = `
        <div class="message-bubble">
            <div class="message-text">${escapeHtml(message.text)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesArea.appendChild(div);
}

// Send message
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const text = messageInput.value.trim();
    
    if (!text || !currentConversationId) {
        return;
    }
    
    setButtonLoading(true);
    
    try {
        const messageData = {
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: new Date().toISOString()
        };
        
        // Add message to conversation
        await db.collection('conversations')
            .doc(currentConversationId)
            .collection('messages')
            .add(messageData);
        
        // Update conversation last message
        await db.collection('conversations').doc(currentConversationId).update({
            lastMessage: text,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        messageInput.value = '';
        messageInput.focus();
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message: ' + error.message);
    } finally {
        setButtonLoading(false);
    }
});

// Back button (mobile)
backBtn.addEventListener('click', () => {
    activeChat.classList.add('d-none');
    noChatSelected.classList.remove('d-none');
    sidebar.classList.remove('hidden');
    
    // Unsubscribe from messages
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    selectedUser = null;
    currentConversationId = null;
});

// Search users
searchUsers.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const name = item.querySelector('.user-item-name').textContent.toLowerCase();
        if (name.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});

// Allow Enter to send
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        messageForm.dispatchEvent(new Event('submit'));
    }
});

// Helper functions
function formatTime(date) {
    const now = new Date();
    const messageDate = new Date(date);
    const isToday = now.toDateString() === messageDate.toDateString();
    
    const hours = messageDate.getHours().toString().padStart(2, '0');
    const minutes = messageDate.getMinutes().toString().padStart(2, '0');
    
    if (isToday) {
        return `${hours}:${minutes}`;
    } else {
        const day = messageDate.getDate().toString().padStart(2, '0');
        const month = (messageDate.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month} ${hours}:${minutes}`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function setButtonLoading(isLoading) {
    const sendText = document.getElementById('sendText');
    const sendSpinner = document.getElementById('sendSpinner');
    
    if (isLoading) {
        sendBtn.disabled = true;
        sendText.textContent = 'Sending...';
        sendSpinner.classList.remove('d-none');
    } else {
        sendBtn.disabled = false;
        sendText.textContent = 'Send';
        sendSpinner.classList.add('d-none');
    }
}

// Update online status when window closes
window.addEventListener('beforeunload', async () => {
    if (currentUser) {
        await db.collection('users').doc(currentUser.uid).update({
            online: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
});

console.log('Chat.js loaded successfully');