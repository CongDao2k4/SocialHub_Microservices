import { X, Circle } from "lucide-react";

const CreateGroupModal = ({
    onClose,
    groupName,
    setGroupName,
    friends,
    selectedFriends,
    toggleSelectFriend,
    onSubmit
}) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fadeIn">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm">Tạo nhóm chat mới</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-800 transition cursor-pointer p-1 rounded-lg hover:bg-slate-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Tên nhóm</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Ví dụ: Nhóm Học Tập..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 transition"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-2">Chọn thành viên</label>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {friends.length > 0 ? (
                                friends.map((f) => {
                                    const isSelected = selectedFriends.includes(f.id);
                                    return (
                                        <div
                                            key={f.id}
                                            onClick={() => toggleSelectFriend(f.id)}
                                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border transition ${
                                                isSelected ? "bg-blue-50 border-blue-300" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                            }`}
                                        >
                                            <div className="flex items-center space-x-2.5">
                                                <img
                                                    src={f.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                    className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                                    alt="Avatar"
                                                />
                                                <span className="text-xs font-medium text-slate-800">{f.displayName}</span>
                                            </div>
                                            <Circle className={`w-4 h-4 ${isSelected ? "fill-blue-600 text-blue-600" : "text-slate-300"}`} />
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-[10px] text-slate-400 italic text-center py-4">Bạn chưa có người bạn nào để tạo nhóm.</p>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!groupName.trim() || selectedFriends.length === 0}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer shadow-md shadow-blue-600/20"
                    >
                        Tạo nhóm
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateGroupModal;
