import mongoose from 'mongoose';

const fromUserSchema = new mongoose.Schema({
  id: { type: String, required: true },
  displayName: { type: String, required: true },
  avatarUrl: { type: String, default: null }
}, { _id: false });

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'friend_request',
      'friend_accepted',
      'post_liked',
      'post_commented',
      'post_shared',
      'new_message',
      'group_added'
    ]
  },
  message: { type: String, required: true },
  fromUser: { type: fromUserSchema, required: true },
  referenceId: { type: String, default: null },
  referenceType: {
    type: String,
    enum: ['post', 'friend_request', 'conversation', 'group'],
    default: null
  },
  isRead: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

export const Notification = mongoose.model('Notification', notificationSchema);
