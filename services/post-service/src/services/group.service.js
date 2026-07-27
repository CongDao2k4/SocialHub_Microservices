import { groupRepository } from '../repositories/group.repository.js';
import { postRepository } from '../repositories/post.repository.js';
import { getUserProfile } from '../utils/api.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/error.js';

export const groupService = {
  createGroup: async ({ name, description, avatarUrl, coverUrl, privacy, postApprovalRequired, createdBy }) => {
    if (!name) {
      throw new BadRequestError('Group name is required');
    }
    return await groupRepository.create({
      name,
      description,
      avatarUrl,
      coverUrl,
      privacy,
      postApprovalRequired,
      createdBy
    });
  },

  getGroupDetails: async (groupId, userId, token) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Check user membership status
    const member = await groupRepository.findMember(groupId, userId);
    
    return {
      ...group,
      currentUserMemberStatus: member ? member.status : null,
      currentUserRole: member ? member.role : null
    };
  },

  searchGroups: async (query) => {
    return await groupRepository.search(query || '');
  },

  joinGroup: async (groupId, userId) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const existingMember = await groupRepository.findMember(groupId, userId);
    if (existingMember) {
      throw new BadRequestError('You have already joined or sent a request to this group');
    }

    // Public group: Approved immediately. Private group: Pending approval
    const status = group.privacy === 'public' ? 'approved' : 'pending';
    const role = 'member';

    return await groupRepository.addMember({
      groupId,
      userId,
      role,
      status
    });
  },

  leaveGroup: async (groupId, userId) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const member = await groupRepository.findMember(groupId, userId);
    if (!member) {
      throw new BadRequestError('You are not a member of this group');
    }

    if (member.role === 'admin') {
      throw new BadRequestError('Group creator/admin cannot leave the group. You must delete the group or transfer admin role first.');
    }

    return await groupRepository.removeMember(groupId, userId);
  },

  getMembers: async (groupId, status, requestingUserId, token) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Access control: Only members can view member list for private groups
    if (group.privacy === 'private') {
      const requester = await groupRepository.findMember(groupId, requestingUserId);
      if (!requester || requester.status !== 'approved') {
        throw new ForbiddenError('Access denied: You must be a member of this private group');
      }
    }

    const members = await groupRepository.findMembers(groupId, status);
    
    // Resolve user profile for each member
    const enrichedMembers = await Promise.all(
      members.map(async (m) => {
        const profile = await getUserProfile(m.user_id, token);
        return {
          ...m,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl
        };
      })
    );

    return enrichedMembers;
  },

  approveMember: async (groupId, userIdToApprove, adminUserId) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Verify requesting user is admin/moderator
    const requester = await groupRepository.findMember(groupId, adminUserId);
    if (!requester || (requester.role !== 'admin' && requester.role !== 'moderator') || requester.status !== 'approved') {
      throw new ForbiddenError('Access denied: Only group admin or moderator can approve members');
    }

    const targetMember = await groupRepository.findMember(groupId, userIdToApprove);
    if (!targetMember) {
      throw new NotFoundError('Membership request not found');
    }

    if (targetMember.status === 'approved') {
      throw new BadRequestError('User is already an approved member');
    }

    return await groupRepository.updateMemberStatus(groupId, userIdToApprove, 'approved');
  },

  removeMember: async (groupId, userIdToRemove, adminUserId) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Verify requesting user is admin or moderator (moderators cannot remove other moderators/admins)
    const requester = await groupRepository.findMember(groupId, adminUserId);
    if (!requester || requester.status !== 'approved') {
      throw new ForbiddenError('Access denied: Unauthorized');
    }

    const targetMember = await groupRepository.findMember(groupId, userIdToRemove);
    if (!targetMember) {
      throw new NotFoundError('Member not found in group');
    }

    if (targetMember.role === 'admin') {
      throw new ForbiddenError('Cannot remove group creator/admin');
    }

    if (requester.role === 'moderator' && (targetMember.role === 'moderator' || targetMember.role === 'admin')) {
      throw new ForbiddenError('Moderators cannot remove other moderators or admins');
    }

    if (requester.role !== 'admin' && requester.role !== 'moderator') {
      throw new ForbiddenError('Only group admin or moderator can remove members');
    }

    return await groupRepository.removeMember(groupId, userIdToRemove);
  },

  updateMemberRole: async (groupId, userIdToUpdate, newRole, adminUserId) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Only admin can change roles
    const requester = await groupRepository.findMember(groupId, adminUserId);
    if (!requester || requester.role !== 'admin' || requester.status !== 'approved') {
      throw new ForbiddenError('Access denied: Only group admin can change roles');
    }

    const targetMember = await groupRepository.findMember(groupId, userIdToUpdate);
    if (!targetMember || targetMember.status !== 'approved') {
      throw new BadRequestError('User is not an approved member');
    }

    if (targetMember.role === 'admin') {
      throw new ForbiddenError('Cannot change group creator/admin role');
    }

    if (!['admin', 'moderator', 'member'].includes(newRole)) {
      throw new BadRequestError('Invalid role');
    }

    return await groupRepository.updateMemberRole(groupId, userIdToUpdate, newRole);
  },

  createPostInGroup: async ({ groupId, authorId, content, mediaIds, token }) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Verify author is an approved member
    const member = await groupRepository.findMember(groupId, authorId);
    if (!member || member.status !== 'approved') {
      throw new ForbiddenError('You must be a member of the group to post');
    }

    // Post approval status logic
    // Admin and moderator posts are automatically approved
    let status = 'approved';
    if (group.post_approval_required && member.role !== 'admin' && member.role !== 'moderator') {
      status = 'pending';
    }

    const newPost = await postRepository.createGroupPost({
      authorId,
      content,
      mediaIds,
      groupId,
      status
    });

    return newPost;
  },

  getGroupPosts: async (groupId, status, limit, offset, requestingUserId, token) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Access control: Only members can view posts for private groups
    const member = await groupRepository.findMember(groupId, requestingUserId);
    if (group.privacy === 'private' && (!member || member.status !== 'approved')) {
      throw new ForbiddenError('Access denied: You must be a member of this private group');
    }

    // If fetching pending posts, check if requester is admin/moderator
    if (status === 'pending') {
      if (!member || (member.role !== 'admin' && member.role !== 'moderator') || member.status !== 'approved') {
        throw new ForbiddenError('Access denied: Only admins and moderators can view pending posts');
      }
    }

    const posts = await postRepository.findGroupPosts(groupId, status, limit, offset);
    const count = await postRepository.countGroupPosts(groupId, status);

    // Enrich posts with author profile and check like status
    const enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        const author = await getUserProfile(post.author_id, token);
        return {
          ...post,
          author
        };
      })
    );

    return {
      posts: enrichedPosts,
      total: count,
      limit,
      offset
    };
  },

  approvePost: async (groupId, postId, adminUserId) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const requester = await groupRepository.findMember(groupId, adminUserId);
    if (!requester || (requester.role !== 'admin' && requester.role !== 'moderator') || requester.status !== 'approved') {
      throw new ForbiddenError('Access denied: Only group admin or moderator can approve posts');
    }

    const post = await postRepository.findById(postId);
    if (!post || post.group_id !== groupId) {
      throw new NotFoundError('Post not found in this group');
    }

    if (post.status === 'approved') {
      throw new BadRequestError('Post is already approved');
    }

    return await postRepository.updatePostStatus(postId, 'approved');
  },

  rejectPost: async (groupId, postId, adminUserId) => {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const requester = await groupRepository.findMember(groupId, adminUserId);
    if (!requester || (requester.role !== 'admin' && requester.role !== 'moderator') || requester.status !== 'approved') {
      throw new ForbiddenError('Access denied: Only group admin or moderator can reject posts');
    }

    const post = await postRepository.findById(postId);
    if (!post || post.group_id !== groupId) {
      throw new NotFoundError('Post not found in this group');
    }

    // Delete post on rejection
    await postRepository.delete(postId);
    return { success: true, message: 'Post rejected and deleted' };
  },

  getUserGroups: async (userId) => {
    return await groupRepository.findUserGroups(userId);
  }
};
