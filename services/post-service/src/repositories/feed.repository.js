import prisma from '../config/db.js';

export const feedRepository = {
  getRecentPostsWithCursor: async (cursor, limit, allowedAuthorIds) => {
    return await prisma.post.findMany({
      where: {
        group_id: null,
        OR: [
          { visibility: 'public' },
          { visibility: null },
          {
            visibility: 'friends',
            author_id: { in: allowedAuthorIds }
          }
        ]
      },
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

  getRecentPostsWithOffset: async (limit, offset, allowedAuthorIds) => {
    return await prisma.post.findMany({
      where: {
        group_id: null,
        OR: [
          { visibility: 'public' },
          { visibility: null },
          {
            visibility: 'friends',
            author_id: { in: allowedAuthorIds }
          }
        ]
      },
      take: limit,
      skip: offset,
      orderBy: {
        created_at: 'desc',
      },
    });
  }
};
