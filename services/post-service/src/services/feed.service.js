import axios from 'axios';
import { feedRepository } from '../repositories/feed.repository.js';
import { likeRepository } from '../repositories/like.repository.js';
import { getUserProfile } from '../utils/api.js';

export const feedService = {
  getFeed: async ({ page, limit, cursor, currentUserId, token }) => {
    let allowedAuthorIds = [currentUserId];
    try {
      const friendServiceUrl = process.env.FRIEND_SERVICE_URL || 'http://friend-service:5000';
      const friendRes = await axios.get(`${friendServiceUrl}/api/friends/internal/${currentUserId}`);
      if (friendRes.data && friendRes.data.success && Array.isArray(friendRes.data.friendIds)) {
        allowedAuthorIds = [currentUserId, ...friendRes.data.friendIds];
      }
    } catch (err) {
      console.error('❌ Error fetching friends for feed:', err.message);
    }

    let posts = [];
    
    if (cursor) {
      posts = await feedRepository.getRecentPostsWithCursor(cursor, limit, allowedAuthorIds);
    } else {
      const offset = (page - 1) * limit;
      posts = await feedRepository.getRecentPostsWithOffset(limit, offset, allowedAuthorIds);
    }

    const postsWithDetails = await Promise.all(posts.map(async (post) => {
      const author = await getUserProfile(post.author_id, token);
      const isLikedByMe = await likeRepository.checkUserLike(post.id, currentUserId);
      
      return {
        ...post,
        author,
        isLikedByMe
      };
    }));

    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;

    return {
      posts: postsWithDetails,
      nextCursor
    };
  }
};
