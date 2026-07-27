import prisma from '../config/db.js';

export const postRepository = {
  create: async ({ authorId, content, mediaIds, visibility }) => {
    return await prisma.post.create({
      data: {
        author_id: authorId,
        content: content || '',
        media_ids: mediaIds || [],
        visibility: visibility || 'friends',
      }
    });
  },

  findById: async (id) => {
    return await prisma.post.findUnique({ where: { id } });
  },

  update: async (id, { content, mediaIds }) => {
    return await prisma.post.update({
      where: { id },
      data: {
        content: content || '',
        media_ids: mediaIds || [],
        updated_at: new Date()
      }
    });
  },

  delete: async (id) => {
    await prisma.post.delete({ where: { id } });
  },

  findByAuthorId: async (authorId, limit, offset, allowedVisibilities = ['public', 'friends']) => {
    return await prisma.post.findMany({
      where: { 
        author_id: authorId,
        group_id: null,
        OR: [
          { visibility: { in: allowedVisibilities } },
          { visibility: null }
        ]
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset
    });
  },

  countByAuthorId: async (authorId, allowedVisibilities = ['public', 'friends']) => {
    return await prisma.post.count({ 
      where: { 
        author_id: authorId,
        group_id: null,
        OR: [
          { visibility: { in: allowedVisibilities } },
          { visibility: null }
        ]
      } 
    });
  },

  incrementCommentCount: async (id) => {
    await prisma.post.update({
      where: { id },
      data: { comment_count: { increment: 1 } }
    });
  },

  decrementCommentCount: async (id) => {
    await prisma.$executeRaw`UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ${id}::uuid`;
  },

  incrementShareCount: async (id) => {
    await prisma.post.update({
      where: { id },
      data: { share_count: { increment: 1 } }
    });
  },

  incrementLikeCount: async (id) => {
    const post = await prisma.post.update({
      where: { id },
      data: { like_count: { increment: 1 } },
      select: { like_count: true }
    });
    return post.like_count;
  },

  decrementLikeCount: async (id) => {
    const result = await prisma.$queryRaw`UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ${id}::uuid RETURNING like_count`;
    return result[0]?.like_count;
  },
  
  createShared: async ({ authorId, content, isShared, originalPostId, visibility }) => {
    return await prisma.post.create({
      data: {
        author_id: authorId,
        content: content || '',
        is_shared: isShared,
        original_post_id: originalPostId,
        visibility: visibility || 'friends'
      }
    });
  },

  createReel: async ({ authorId, caption, mediaId }) => {
    return await prisma.post.create({
      data: {
        author_id: authorId,
        content: caption || '',
        media_ids: mediaId ? [mediaId] : [],
        type: 'reel',
        visibility: 'public'
      }
    });
  },

  findReelsFeed: async (limit, offset) => {
    return await prisma.post.findMany({
      where: { type: 'reel' },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset
    });
  },

  countReelsFeed: async () => {
    return await prisma.post.count({
      where: { type: 'reel' }
    });
  },

  findReelsByAuthorId: async (authorId, limit, offset) => {
    return await prisma.post.findMany({
      where: { author_id: authorId, type: 'reel' },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset
    });
  },

  countReelsByAuthorId: async (authorId) => {
    return await prisma.post.count({
      where: { author_id: authorId, type: 'reel' }
    });
  },

  incrementViewCount: async (id) => {
    return await prisma.post.update({
      where: { id },
      data: { view_count: { increment: 1 } }
    });
  },

  createGroupPost: async ({ authorId, content, mediaIds, groupId, status }) => {
    return await prisma.post.create({
      data: {
        author_id: authorId,
        content: content || '',
        media_ids: mediaIds || [],
        visibility: 'public',
        group_id: groupId,
        status: status || 'pending'
      }
    });
  },

  findGroupPosts: async (groupId, status, limit, offset, authorId) => {
    return await prisma.post.findMany({
      where: {
        group_id: groupId,
        status: status || 'approved',
        ...(authorId ? { author_id: authorId } : {})
      },
      include: {
        group: true
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset
    });
  },

  countGroupPosts: async (groupId, status, authorId) => {
    return await prisma.post.count({
      where: {
        group_id: groupId,
        status: status || 'approved',
        ...(authorId ? { author_id: authorId } : {})
      }
    });
  },

  updatePostStatus: async (postId, status) => {
    return await prisma.post.update({
      where: { id: postId },
      data: { status }
    });
  }
};
