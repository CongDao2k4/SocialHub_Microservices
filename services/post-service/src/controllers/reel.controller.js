import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getUserProfile, validateMediaIds } from '../utils/api.js';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error.statusCode) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error(error);
  return errorResponse(res, 500, defaultMessage);
};

// 1. Tạo Reel mới
export const createReel = async (req, res) => {
  try {
    const { caption, mediaId } = req.body;
    const authorId = req.user.id;
    const token = req.headers.authorization;

    if (!mediaId) {
      return errorResponse(res, 400, 'Reel must have a video file (mediaId)');
    }

    // Validate mediaId với media-service
    const isValidMedia = await validateMediaIds([mediaId], token);
    if (!isValidMedia) {
      return errorResponse(res, 400, 'Invalid or non-existent media file');
    }

    const reel = await prisma.reel.create({
      data: {
        author_id: authorId,
        content: caption || '',
        media_ids: [mediaId],
        view_count: 0,
        like_count: 0,
        comment_count: 0
      }
    });

    return successResponse(res, 201, reel);
  } catch (error) {
    return handleError(res, error, 'Create Reel Error');
  }
};

// 2. Lấy danh sách Reels
export const getReels = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const currentUserId = req.user.id;
    const token = req.headers.authorization;

    const total = await prisma.reel.count();
    const reels = await prisma.reel.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset
    });

    const reelsWithDetails = await Promise.all(reels.map(async (reel) => {
      // Lấy profile tác giả
      const author = await getUserProfile(reel.author_id, token);
      
      // Kiểm tra user hiện tại đã like reel này chưa
      const like = await prisma.reelLike.findUnique({
        where: {
          reel_id_user_id: {
            reel_id: reel.id,
            user_id: currentUserId
          }
        }
      });

      return {
        ...reel,
        author,
        isLikedByMe: !!like
      };
    }));

    return successResponse(res, 200, reelsWithDetails, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return handleError(res, error, 'Get Reels Error');
  }
};

// 3. Lấy Reels của User cụ thể
export const getUserReels = async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.id;
    const token = req.headers.authorization;

    const reels = await prisma.reel.findMany({
      where: { author_id: userId },
      orderBy: { created_at: 'desc' }
    });

    const author = await getUserProfile(userId, token);

    const reelsWithDetails = await Promise.all(reels.map(async (reel) => {
      const like = await prisma.reelLike.findUnique({
        where: {
          reel_id_user_id: {
            reel_id: reel.id,
            user_id: currentUserId
          }
        }
      });

      return {
        ...reel,
        author,
        isLikedByMe: !!like
      };
    }));

    return successResponse(res, 200, reelsWithDetails);
  } catch (error) {
    return handleError(res, error, 'Get User Reels Error');
  }
};

// 4. Tăng lượt xem Reel
export const incrementReelView = async (req, res) => {
  try {
    const id = req.params.id;
    
    const updatedReel = await prisma.reel.update({
      where: { id },
      data: {
        view_count: { increment: 1 }
      }
    });

    return successResponse(res, 200, { view_count: updatedReel.view_count });
  } catch (error) {
    return handleError(res, error, 'Increment Reel View Error');
  }
};

// 5. Thả tim Reels (Like)
export const likeReel = async (req, res) => {
  try {
    const reelId = req.params.id;
    const userId = req.user.id;

    // Kiểm tra reel có tồn tại ko
    const reelExists = await prisma.reel.findUnique({ where: { id: reelId } });
    if (!reelExists) {
      return errorResponse(res, 404, 'Reel not found');
    }

    // Tạo bản ghi Like (nếu chưa like)
    let isNewLike = false;
    try {
      await prisma.reelLike.create({
        data: {
          reel_id: reelId,
          user_id: userId
        }
      });
      isNewLike = true;
    } catch (e) {
      // Đã like từ trước (unique constraint error)
    }

    let currentLikeCount = reelExists.like_count || 0;
    if (isNewLike) {
      // Tăng like_count
      const updatedReel = await prisma.reel.update({
        where: { id: reelId },
        data: { like_count: { increment: 1 } }
      });
      currentLikeCount = updatedReel.like_count;
    }

    return successResponse(res, 200, { like_count: currentLikeCount });
  } catch (error) {
    return handleError(res, error, 'Like Reel Error');
  }
};

// 6. Bỏ thả tim Reels (Unlike)
export const unlikeReel = async (req, res) => {
  try {
    const reelId = req.params.id;
    const userId = req.user.id;

    const reelExists = await prisma.reel.findUnique({ where: { id: reelId } });
    if (!reelExists) {
      return errorResponse(res, 404, 'Reel not found');
    }

    // Xoá bản ghi Like
    let isDeleted = false;
    try {
      await prisma.reelLike.delete({
        where: {
          reel_id_user_id: {
            reel_id: reelId,
            user_id: userId
          }
        }
      });
      isDeleted = true;
    } catch (e) {
      // Chưa like hoặc đã xoá rồi
    }

    let currentLikeCount = reelExists.like_count || 0;
    if (isDeleted) {
      // Giảm like_count (không để âm)
      const newLikeCount = Math.max((reelExists.like_count || 0) - 1, 0);
      const updatedReel = await prisma.reel.update({
        where: { id: reelId },
        data: { like_count: newLikeCount }
      });
      currentLikeCount = updatedReel.like_count;
    }

    return successResponse(res, 200, { like_count: currentLikeCount });
  } catch (error) {
    return handleError(res, error, 'Unlike Reel Error');
  }
};

// 7. Lấy comments của Reel
export const getReelComments = async (req, res) => {
  try {
    const reelId = req.params.id;
    const token = req.headers.authorization;

    const comments = await prisma.reelComment.findMany({
      where: { reel_id: reelId },
      orderBy: { created_at: 'desc' }
    });

    const commentsWithAuthor = await Promise.all(comments.map(async (comment) => {
      const author = await getUserProfile(comment.author_id, token);
      return {
        ...comment,
        author
      };
    }));

    return successResponse(res, 200, commentsWithAuthor);
  } catch (error) {
    return handleError(res, error, 'Get Reel Comments Error');
  }
};

// 8. Tạo comment cho Reel
export const createReelComment = async (req, res) => {
  try {
    const reelId = req.params.id;
    const { content } = req.body;
    const authorId = req.user.id;
    const token = req.headers.authorization;

    if (!content || content.trim() === '') {
      return errorResponse(res, 400, 'Comment content cannot be empty');
    }

    // Kiểm tra Reel tồn tại
    const reelExists = await prisma.reel.findUnique({ where: { id: reelId } });
    if (!reelExists) {
      return errorResponse(res, 404, 'Reel not found');
    }

    // Tạo ReelComment
    const newComment = await prisma.reelComment.create({
      data: {
        reel_id: reelId,
        author_id: authorId,
        content: content.trim()
      }
    });

    // Cập nhật comment_count trong Reel
    await prisma.reel.update({
      where: { id: reelId },
      data: { comment_count: { increment: 1 } }
    });

    const author = await getUserProfile(authorId, token);

    return successResponse(res, 201, {
      ...newComment,
      author
    });
  } catch (error) {
    return handleError(res, error, 'Create Reel Comment Error');
  }
};
