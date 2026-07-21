import { useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { X, UserPlus, UserMinus } from "lucide-react";

const GroupMembersModal = ({ conversation, onClose, onGroupUpdated, friends }) => {
    const { user: currentUser } = useAuth();
    const [isAdding, setIsAdding] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);

    const groupId = conversation.groupRef?._id || conversation.groupRef?.id;
    const currentMembers = conversation.groupRef?.members || [];
    const currentMemberIds = new Set(currentMembers.map(m => m.userId));

    // Xác định vai trò của user hiện tại
    const currentUserMember = currentMembers.find(m => m.userId === currentUser?.id);
    const isCurrentUserAdmin = currentUserMember?.role === "admin";

    // Lọc danh sách bạn bè chưa có trong nhóm
    const addableFriends = friends.filter(f => !currentMemberIds.has(f.id));

    const handleAddMember = async (friendId) => {
        if (!groupId) return;
        setIsAdding(true);
        try {
            const res = await api.post(`/groups/${groupId}/members`, { userId: friendId });
            if (res.data && res.data.success) {
                onGroupUpdated(res.data.data);
                alert("Đã thêm thành viên thành công!");
            }
        } catch (err) {
            console.error("❌ Lỗi thêm thành viên vào nhóm:", err);
            alert(err.response?.data?.message || "Không thể thêm thành viên!");
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async (memberId) => {
        const confirmRemove = window.confirm("Bạn có chắc chắn muốn mời thành viên này rời khỏi nhóm?");
        if (!confirmRemove) return;

        setIsRemoving(true);
        try {
            const res = await api.delete(`/groups/${groupId}/members/${memberId}`);
            if (res.data && res.data.success) {
                onGroupUpdated(res.data.data.group);
                alert("Đã xóa thành viên khỏi nhóm.");
            }
        } catch (err) {
            console.error("❌ Lỗi xóa thành viên khỏi nhóm:", err);
            alert(err.response?.data?.message || "Không thể xóa thành viên!");
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-fadeIn">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm">Quản lý thành viên nhóm</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-lg hover:bg-slate-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 sm:p-5 space-y-5 flex-1 overflow-y-auto">
                    {/* Danh sách thành viên hiện tại */}
                    <div>
                        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                            Thành viên hiện tại ({currentMembers.length})
                        </h4>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                            {currentMembers.map((member) => (
                                <div key={member.userId} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                                    <div className="flex items-center space-x-2.5">
                                        <img
                                            src={member.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${member.userId}`}
                                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                            alt="Avatar"
                                        />
                                        <span className="text-xs font-semibold text-slate-800">{member.displayName}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                            member.role === "admin" ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-600"
                                        }`}>
                                            {member.role === "admin" ? "Trưởng nhóm" : "Thành viên"}
                                        </span>
                                        {/* Chỉ Trưởng nhóm (Admin) mới có quyền xóa thành viên khác */}
                                        {isCurrentUserAdmin && member.userId !== currentUser?.id && (
                                            <button
                                                disabled={isRemoving}
                                                onClick={() => handleRemoveMember(member.userId)}
                                                title="Mời ra khỏi nhóm"
                                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition disabled:opacity-50 cursor-pointer"
                                            >
                                                <UserMinus className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Thêm thành viên mới */}
                    <div className="border-t border-slate-100 pt-4">
                        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                            Thêm thành viên mới
                        </h4>
                        {addableFriends.length > 0 ? (
                            <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                                {addableFriends.map((friend) => (
                                    <div key={friend.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                                        <div className="flex items-center space-x-2.5">
                                            <img
                                                src={friend.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.id}`}
                                                className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                                alt="Avatar"
                                            />
                                            <span className="text-xs font-semibold text-slate-800">{friend.displayName}</span>
                                        </div>
                                        <button
                                            disabled={isAdding}
                                            onClick={() => handleAddMember(friend.id)}
                                            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            <span>Thêm</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[10px] text-slate-400 italic text-center py-4">Tất cả bạn bè đã tham gia nhóm này.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupMembersModal;
