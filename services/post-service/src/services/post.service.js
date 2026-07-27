import axios from 'axios';
import { postRepository } from '../repositories/post.repository.js';
import { likeRepository } from '../repositories/like.repository.js';
import { validateMediaIds, getUserProfile } from '../utils/api.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/error.js';

export const postService = {
  createPost: async ({ authorId, content, mediaIds, visibility, token }) => {
    if (!content && (!mediaIds || mediaIds.length === 0)) {
      throw new BadRequestError('Post cannot be empty (no content and no media)');
    }

    if (mediaIds && mediaIds.length > 0) {
      const isValid = await validateMediaIds(mediaIds, token);
      if (!isValid) {
        throw new BadRequestError('One or more media items are invalid or not found');
      }
    }

    const newPost = await postRepository.create({ authorId, content, mediaIds, visibility });

    // TODO: Invalidate feed cache for author's friends in Redis
    // We would fetch friends from friend-service, then DEL feed:{friendId}

    return newPost;
  },

  getPostById: async ({ id, userId, token }) => {
    const post = await postRepository.findById(id);

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const author = await getUserProfile(post.author_id, token);
    const isLikedByMe = await likeRepository.checkUserLike(id, userId);

    return {
      ...post,
      author,
      isLikedByMe
    };
  },

  updatePost: async ({ id, authorId, content, mediaIds, token }) => {
    const post = await postRepository.findById(id);

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    if (post.author_id !== authorId) {
      throw new ForbiddenError('Only the author can update this post');
    }

    if (mediaIds && mediaIds.length > 0) {
      const isValid = await validateMediaIds(mediaIds, token);
      if (!isValid) {
        throw new BadRequestError('One or more media items are invalid or not found');
      }
    }

    return await postRepository.update(id, { content, mediaIds });
  },

  deletePost: async ({ id, authorId }) => {
    const post = await postRepository.findById(id);

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    if (post.author_id !== authorId) {
      throw new ForbiddenError('Only the author can delete this post');
    }

    await postRepository.delete(id);
  },

  getUserPosts: async ({ userId, currentUserId, page, limit, token }) => {
    const offset = (page - 1) * limit;
    
    let allowedVisibilities = ['public'];
    if (currentUserId === userId) {
      allowedVisibilities = ['public', 'friends'];
    } else {
      try {
        const friendServiceUrl = process.env.FRIEND_SERVICE_URL || 'http://friend-service:5000';
        const friendRes = await axios.get(`${friendServiceUrl}/api/friends/internal/${currentUserId}`);
        if (friendRes.data && friendRes.data.success && Array.isArray(friendRes.data.friendIds)) {
          if (friendRes.data.friendIds.includes(userId)) {
            allowedVisibilities = ['public', 'friends'];
          }
        }
      } catch (err) {
        console.error('❌ Error checking friendship for user posts:', err.message);
      }
    }

    const total = await postRepository.countByAuthorId(userId, allowedVisibilities);
    const posts = await postRepository.findByAuthorId(userId, limit, offset, allowedVisibilities);
    const author = await getUserProfile(userId, token);

    const postsWithDetails = await Promise.all(posts.map(async (post) => {
      const isLikedByMe = await likeRepository.checkUserLike(post.id, currentUserId);
      return {
        ...post,
        author,
        isLikedByMe
      };
    }));

    return {
      posts: postsWithDetails,
      total,
      totalPages: Math.ceil(total / limit)
    };
  }
};
