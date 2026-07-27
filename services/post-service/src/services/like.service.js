import { likeRepository } from '../repositories/like.repository.js';
import { postRepository } from '../repositories/post.repository.js';
import { redisPublisher } from '../config/redis.js';
import { NotFoundError } from '../utils/error.js';

export const likeService = {
  likePost: async ({ postId, userId }) => {
    const post = await postRepository.findById(postId);
    
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const likeRecordId = await likeRepository.addLike(postId, userId);
    let currentLikeCount = post.like_count;
    
    if (likeRecordId) {
      currentLikeCount = await postRepository.incrementLikeCount(postId);

      const eventPayload = {
        eventId: likeRecordId.id,
        userId: userId,
        postId: postId,
        postAuthorId: post.author_id,
        occurredAt: new Date().toISOString()
      };
      await redisPublisher.publish('post.liked', JSON.stringify(eventPayload));
    }

    return currentLikeCount;
  },

  unlikePost: async ({ postId, userId }) => {
    const post = await postRepository.findById(postId);
    
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const deleteResult = await likeRepository.removeLike(postId, userId);
    let currentLikeCount = post.like_count;

    if (deleteResult) {
      currentLikeCount = await postRepository.decrementLikeCount(postId);
    }

    return currentLikeCount;
  },

  getPostLikes: async ({ postId, token }) => {
    const likes = await likeRepository.findByPostId(postId, 20);
    const likesWithUser = await Promise.all(likes.map(async (like) => {
      try {
        const user = await getUserProfile(like.user_id, token);
        return {
          ...like,
          user
        };
      } catch (err) {
        return {
          ...like,
          user: { id: like.user_id, displayName: 'Người dùng' }
        };
      }
    }));
    return likesWithUser;
  }
};
