import prisma from '../config/db.js';

export const groupRepository = {
  create: async ({ name, description, avatarUrl, coverUrl, privacy, postApprovalRequired, createdBy }) => {
    return await prisma.group.create({
      data: {
        name,
        description,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        privacy: privacy || 'public',
        post_approval_required: postApprovalRequired !== undefined ? postApprovalRequired : true,
        created_by: createdBy,
        members: {
          create: {
            user_id: createdBy,
            role: 'admin',
            status: 'approved'
          }
        }
      },
      include: {
        members: true
      }
    });
  },

  findById: async (id) => {
    return await prisma.group.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: { where: { status: 'approved' } } }
        }
      }
    });
  },

  update: async (id, data) => {
    return await prisma.group.update({
      where: { id },
      data
    });
  },

  search: async (query) => {
    return await prisma.group.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        _count: {
          select: { members: { where: { status: 'approved' } } }
        }
      }
    });
  },

  addMember: async ({ groupId, userId, role, status }) => {
    return await prisma.groupMember.create({
      data: {
        group_id: groupId,
        user_id: userId,
        role: role || 'member',
        status: status || 'pending'
      }
    });
  },

  findMember: async (groupId, userId) => {
    return await prisma.groupMember.findUnique({
      where: {
        group_id_user_id: {
          group_id: groupId,
          user_id: userId
        }
      }
    });
  },

  findMembers: async (groupId, status) => {
    return await prisma.groupMember.findMany({
      where: {
        group_id: groupId,
        ...(status ? { status } : {})
      },
      orderBy: {
        joined_at: 'desc'
      }
    });
  },

  updateMemberStatus: async (groupId, userId, status) => {
    return await prisma.groupMember.update({
      where: {
        group_id_user_id: {
          group_id: groupId,
          user_id: userId
        }
      },
      data: { status }
    });
  },

  updateMemberRole: async (groupId, userId, role) => {
    return await prisma.groupMember.update({
      where: {
        group_id_user_id: {
          group_id: groupId,
          user_id: userId
        }
      },
      data: { role }
    });
  },

  removeMember: async (groupId, userId) => {
    return await prisma.groupMember.delete({
      where: {
        group_id_user_id: {
          group_id: groupId,
          user_id: userId
        }
      }
    });
  },

  findUserGroups: async (userId) => {
    return await prisma.group.findMany({
      where: {
        members: {
          some: {
            user_id: userId,
            status: 'approved'
          }
        }
      },
      include: {
        _count: {
          select: { members: { where: { status: 'approved' } } }
        }
      }
    });
  }
};
