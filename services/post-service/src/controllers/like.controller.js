import { successResponse, errorResponse } from '../utils/response.js';
import { likeService } from '../services/like.service.js';
import { CustomError } from '../utils/error.js';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error instanceof CustomError) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error(error);
  return errorResponse(res, 500, defaultMessage);
};

export const likePost = async (req, res) => {
  try {
    const likeCount = await likeService.likePost({
      postId: req.params.id,
      userId: req.user.id
    });
    return successResponse(res, 200, { likeCount });
  } catch (error) {
    return handleError(res, error, 'Like Post Error');
  }
};

export const unlikePost = async (req, res) => {
  try {
    const likeCount = await likeService.unlikePost({
      postId: req.params.id,
      userId: req.user.id
    });
    return successResponse(res, 200, { likeCount });
  } catch (error) {
    return handleError(res, error, 'Unlike Post Error');
  }
};

export const getPostLikes = async (req, res) => {
  try {
    const likes = await likeService.getPostLikes({
      postId: req.params.id,
      token: req.token
    });
    return successResponse(res, 200, likes);
  } catch (error) {
    return handleError(res, error, 'Get Post Likes Error');
  }
};
