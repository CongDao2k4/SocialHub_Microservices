import prisma from '../config/db.js';

export const feedRepository = {
  getRecentPostsWithCursor: async (cursor, limit) => {
    return await prisma.post.findMany({
      where: { group_id: null },
      take: limit,
      skip: 1, // Skip the cursor
      cursor: {
        id: cursor,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  },

  getRecentPostsWithOffset: async (limit, offset) => {
    return await prisma.post.findMany({
      where: { group_id: null },
      take: limit,
      skip: offset,
      orderBy: {
        created_at: 'desc',
      },
    });
  }
};
