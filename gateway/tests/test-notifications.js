import axios from 'axios';
import { io } from 'socket.io-client';

const GATEWAY_URL = 'http://localhost:8080/api';
const GATEWAY_SOCKET_URL = 'http://localhost:8080';

async function runNotificationTests() {
  console.log('🏁 Starting Gateway & Notification Service Integration Tests...');

  let userAToken = '';
  let userBToken = '';
  let userAId = '';
  let userBId = '';
  let socket = null;

  // 1. Register User A
  const emailA = `usera-${Date.now()}@example.com`;
  try {
    const res = await axios.post(`${GATEWAY_URL}/auth/register`, {
      email: emailA,
      password: 'SecurePassword123!',
      name: 'User A Trigger'
    });
    userAToken = res.data.token.accessToken;
    userAId = res.data.user.id;
    console.log('✅ User A Registered. ID:', userAId);
  } catch (err) {
    console.error('❌ User A Registration Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 2. Register User B
  const emailB = `userb-${Date.now()}@example.com`;
  try {
    const res = await axios.post(`${GATEWAY_URL}/auth/register`, {
      email: emailB,
      password: 'SecurePassword123!',
      name: 'User B Recipient'
    });
    userBToken = res.data.token.accessToken;
    userBId = res.data.user.id;
    console.log('✅ User B Registered. ID:', userBId);
  } catch (err) {
    console.error('❌ User B Registration Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 3. Connect User B Socket.IO client via Gateway Proxy
  console.log('🔌 Connecting User B Socket.IO client to Gateway...');
  socket = io(GATEWAY_SOCKET_URL, {
    path: '/socket.io/',
    auth: {
      token: `Bearer ${userBToken}`
    },
    transports: ['websocket']
  });

  // Flag to check if we received socket events
  let notificationReceived = false;
  let countReceived = false;
  let receivedNotificationId = '';

  socket.on('connect', () => {
    console.log('✅ User B Socket connected successfully to Gateway WebSocket proxy!');
    
    // Trigger friend request from User A to User B
    sendFriendRequest();
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Socket connection error:', err.message);
    cleanupAndExit(1);
  });

  socket.on('notification:new', (data) => {
    console.log('📥 [Socket.IO] User B received "notification:new" event:', data);
    if (data.type === 'friend_request' && data.fromUser.id === userAId) {
      console.log('✅ Notification type & sender verification PASSED!');
      notificationReceived = true;
      receivedNotificationId = data.id;
      checkAllConditions();
    }
  });

  socket.on('notification:count', (data) => {
    console.log('📥 [Socket.IO] User B received "notification:count" event:', data);
    if (data.unreadCount >= 1) {
      console.log('✅ Notification unread count verification PASSED!');
      countReceived = true;
      checkAllConditions();
    }
  });

  // 4. Send Friend Request via Gateway
  async function sendFriendRequest() {
    console.log('📡 Sending friend request from User A to User B...');
    try {
      const res = await axios.post(`${GATEWAY_URL}/friends/request`, {
        toUserId: userBId
      }, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      console.log('✅ Friend request sent from User A. Status:', res.data.message || 'ok');
    } catch (err) {
      console.error('❌ Friend request failed:', err.response?.data || err.message);
      cleanupAndExit(1);
    }
  }

  // Check conditions and proceed to REST API verification
  async function checkAllConditions() {
    if (notificationReceived && countReceived) {
      console.log('🎉 Socket.IO Realtime Push verified successfully!');
      await verifyRestApi();
    }
  }

  // 5. Verify Notification REST API
  async function verifyRestApi() {
    console.log('📡 Fetching User B notifications list via REST API...');
    const headers = { Authorization: `Bearer ${userBToken}` };

    try {
      // Get all notifications
      let res = await axios.get(`${GATEWAY_URL}/notifications`, { headers });
      console.log('✅ Get notifications list success. Count:', res.data.data.length);
      
      const found = res.data.data.find(n => n.id === receivedNotificationId);
      if (!found) {
        console.error('❌ Rest API failed: Notification ID not found in REST response');
        cleanupAndExit(1);
      }
      console.log('✅ Notification presence in REST API verified.');

      // Get unread count
      res = await axios.get(`${GATEWAY_URL}/notifications/unread-count`, { headers });
      console.log('✅ Get unread count success:', res.data.unreadCount);

      // Mark notification as read
      console.log(`📡 Marking notification ${receivedNotificationId} as read...`);
      res = await axios.put(`${GATEWAY_URL}/notifications/${receivedNotificationId}/read`, {}, { headers });
      console.log('✅ Mark read success:', res.data.success);

      // Verify unread count is updated
      res = await axios.get(`${GATEWAY_URL}/notifications/unread-count`, { headers });
      console.log('✅ Get unread count after read success:', res.data.unreadCount);
      
      console.log('\n🎉 ALL REALTIME NOTIFICATION & INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
      cleanupAndExit(0);
    } catch (err) {
      console.error('❌ REST API verification failed:', err.response?.data || err.message);
      cleanupAndExit(1);
    }
  }

  function cleanupAndExit(code) {
    if (socket) {
      socket.disconnect();
    }
    setTimeout(() => {
      process.exit(code);
    }, 500);
  }
}

runNotificationTests();
