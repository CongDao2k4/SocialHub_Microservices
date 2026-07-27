import { groupService } from '../services/group.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { CustomError } from '../utils/error.js';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error instanceof CustomError) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error(error);
  return errorResponse(res, 500, defaultMessage);
};

export const createGroup = async (req, res) => {
  try {
    const group = await groupService.createGroup({
      name: req.body.name,
      description: req.body.description,
      avatarUrl: req.body.avatarUrl,
      coverUrl: req.body.coverUrl,
      privacy: req.body.privacy,
      postApprovalRequired: req.body.postApprovalRequired,
      createdBy: req.user.id
    });
    return successResponse(res, 201, group);
  } catch (error) {
    return handleError(res, error, 'Create Group Error');
  }
};

export const getGroupDetails = async (req, res) => {
  try {
    const details = await groupService.getGroupDetails(
      req.params.id,
      req.user.id,
      req.headers.authorization
    );
    return successResponse(res, 200, details);
  } catch (error) {
    return handleError(res, error, 'Get Group Details Error');
  }
};

export const searchGroups = async (req, res) => {
  try {
    const groups = await groupService.searchGroups(req.query.q);
    return successResponse(res, 200, groups);
  } catch (error) {
    return handleError(res, error, 'Search Groups Error');
  }
};

export const joinGroup = async (req, res) => {
  try {
    const member = await groupService.joinGroup(req.params.id, req.user.id);
    return successResponse(res, 200, member);
  } catch (error) {
    return handleError(res, error, 'Join Group Error');
  }
};

export const leaveGroup = async (req, res) => {
  try {
    await groupService.leaveGroup(req.params.id, req.user.id);
    return successResponse(res, 200, { message: 'Successfully left group' });
  } catch (error) {
    return handleError(res, error, 'Leave Group Error');
  }
};

export const getMembers = async (req, res) => {
  try {
    const members = await groupService.getMembers(
      req.params.id,
      req.query.status,
      req.user.id,
      req.headers.authorization
    );
    return successResponse(res, 200, members);
  } catch (error) {
    return handleError(res, error, 'Get Members Error');
  }
};

export const approveMember = async (req, res) => {
  try {
    const member = await groupService.approveMember(
      req.params.id,
      req.params.userId,
      req.user.id
    );
    return successResponse(res, 200, member);
  } catch (error) {
    return handleError(res, error, 'Approve Member Error');
  }
};

export const removeMember = async (req, res) => {
  try {
    await groupService.removeMember(
      req.params.id,
      req.params.userId,
      req.user.id
    );
    return successResponse(res, 200, { message: 'Member removed successfully' });
  } catch (error) {
    return handleError(res, error, 'Remove Member Error');
  }
};

export const updateMemberRole = async (req, res) => {
  try {
    const member = await groupService.updateMemberRole(
      req.params.id,
      req.params.userId,
      req.body.role,
      req.user.id
    );
    return successResponse(res, 200, member);
  } catch (error) {
    return handleError(res, error, 'Update Member Role Error');
  }
};

export const createPostInGroup = async (req, res) => {
  try {
    const post = await groupService.createPostInGroup({
      groupId: req.params.id,
      authorId: req.user.id,
      content: req.body.content,
      mediaIds: req.body.mediaIds,
      token: req.headers.authorization
    });
    return successResponse(res, 201, post);
  } catch (error) {
    return handleError(res, error, 'Create Post in Group Error');
  }
};

export const getGroupPosts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || 'approved';
    const authorId = req.query.authorId;

    const result = await groupService.getGroupPosts(
      req.params.id,
      status,
      limit,
      offset,
      req.user.id,
      req.headers.authorization,
      authorId
    );
    return successResponse(res, 200, result);
  } catch (error) {
    return handleError(res, error, 'Get Group Posts Error');
  }
};

export const approvePost = async (req, res) => {
  try {
    const post = await groupService.approvePost(
      req.params.id,
      req.params.postId,
      req.user.id
    );
    return successResponse(res, 200, post);
  } catch (error) {
    return handleError(res, error, 'Approve Post Error');
  }
};

export const rejectPost = async (req, res) => {
  try {
    const result = await groupService.rejectPost(
      req.params.id,
      req.params.postId,
      req.user.id
    );
    return successResponse(res, 200, result);
  } catch (error) {
    return handleError(res, error, 'Reject Post Error');
  }
};

export const getUserGroups = async (req, res) => {
  try {
    const groups = await groupService.getUserGroups(req.user.id);
    return successResponse(res, 200, groups);
  } catch (error) {
    return handleError(res, error, 'Get User Groups Error');
  }
};
