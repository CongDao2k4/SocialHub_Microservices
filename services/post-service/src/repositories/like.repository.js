import prisma from '../config/db.js';

export const likeRepository = {
  checkUserLike: async (postId, userId) => {
    const like = await prisma.like.findUnique({
      where: {
        post_id_user_id: {
          post_id: postId,
          user_id: userId
        }
      }
    });
    return !!like;
  },

  addLike: async (postId, userId) => {
    // Prisma's create does not have 'ON CONFLICT DO NOTHING' easily unless using upsert without update or createMany.
    // However, createMany doesn't return the ID. Let's use try-catch for uniqueness constraint or raw.
    // Raw is safer to keep exactly the same behaviour:
    const result = await prisma.$queryRaw`
      INSERT INTO likes (post_id, user_id) 
      VALUES (${postId}::uuid, ${userId}::uuid)
      ON CONFLICT (post_id, user_id) DO NOTHING
      RETURNING id
    `;
    return result[0];
  },

  removeLike: async (postId, userId) => {
    const result = await prisma.$queryRaw`
      DELETE FROM likes WHERE post_id = ${postId}::uuid AND user_id = ${userId}::uuid RETURNING id
    `;
    return result[0];
  },

  findByPostId: async (postId, limit = 20) => {
    return await prisma.like.findMany({
      where: { post_id: postId },
      take: limit,
      orderBy: { created_at: 'desc' }
    });
  }
};
