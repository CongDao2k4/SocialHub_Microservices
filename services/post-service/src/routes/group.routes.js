import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as GroupController from '../controllers/group.controller.js';

const router = express.Router();

// Tất cả các tuyến đường quản lý nhóm đều yêu cầu xác thực người dùng
router.use(requireAuth);

// Quản lý danh sách nhóm & Tìm kiếm
router.post('/groups', GroupController.createGroup);
router.get('/groups', GroupController.getUserGroups);
router.get('/groups/search', GroupController.searchGroups);
router.get('/groups/:id', GroupController.getGroupDetails);

// Đăng bài viết trong nhóm
router.post('/groups/:id/posts', GroupController.createPostInGroup);
router.get('/groups/:id/posts', GroupController.getGroupPosts);

// Quản lý thành viên nhóm
router.post('/groups/:id/join', GroupController.joinGroup);
router.post('/groups/:id/leave', GroupController.leaveGroup);
router.get('/groups/:id/members', GroupController.getMembers);

// Quyền Admin / Moderator duyệt thành viên và phân vai trò
router.post('/groups/:id/members/:userId/approve', GroupController.approveMember);
router.delete('/groups/:id/members/:userId/remove', GroupController.removeMember);
router.put('/groups/:id/members/:userId/role', GroupController.updateMemberRole);

// Quyền Admin / Moderator duyệt bài đăng trong nhóm
router.post('/groups/:id/posts/:postId/approve', GroupController.approvePost);
router.post('/groups/:id/posts/:postId/reject', GroupController.rejectPost);

export default router;
