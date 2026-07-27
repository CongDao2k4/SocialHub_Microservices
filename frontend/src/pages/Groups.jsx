import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Globe, Lock, ShieldCheck, ArrowRight, BookOpen } from "lucide-react";
import api from "../services/api";

const Groups = () => {
    const [groups, setGroups] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Form states for creating a group
    const [groupName, setGroupName] = useState("");
    const [groupDesc, setGroupDesc] = useState("");
    const [groupPrivacy, setGroupPrivacy] = useState("public");
    const [postApproval, setPostApproval] = useState(true);
    const [createLoading, setCreateLoading] = useState(false);

    useEffect(() => {
        fetchJoinedGroups();
    }, []);

    const fetchJoinedGroups = async () => {
        setLoading(true);
        try {
            const res = await api.get("/social-groups");
            if (res.data && res.data.success) {
                setGroups(res.data.data || []);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy danh sách nhóm:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setIsSearching(false);
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await api.get(`/social-groups/search?q=${encodeURIComponent(searchQuery)}`);
            if (res.data && res.data.success) {
                setSearchResults(res.data.data || []);
            }
        } catch (err) {
            console.error("❌ Lỗi tìm kiếm nhóm:", err);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupName.trim()) return;

        setCreateLoading(true);
        try {
            const res = await api.post("/social-groups", {
                name: groupName,
                description: groupDesc,
                privacy: groupPrivacy,
                postApprovalRequired: postApproval
            });

            if (res.data && res.data.success) {
                setShowCreateModal(false);
                // Reset form
                setGroupName("");
                setGroupDesc("");
                setGroupPrivacy("public");
                setPostApproval(true);
                // Fetch again
                fetchJoinedGroups();
            }
        } catch (err) {
            console.error("❌ Lỗi tạo nhóm:", err);
            alert("Không thể tạo nhóm: " + (err.response?.data?.message || err.message));
        } finally {
            setCreateLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
                        <BookOpen className="w-7 h-7 text-blue-600" />
                        <span>Nhóm của bạn</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Khám phá và tham gia các cộng đồng học tập, chia sẻ thông tin.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition cursor-pointer self-start sm:self-auto"
                >
                    <Plus className="w-5 h-5" />
                    <span>Tạo nhóm mới</span>
                </button>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative max-w-xl">
                <input
                    type="text"
                    placeholder="Tìm kiếm nhóm học tập, thảo luận..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!e.target.value.trim()) {
                            setIsSearching(false);
                            setSearchResults([]);
                        }
                    }}
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-12 pr-24 py-3 text-slate-800 placeholder-slate-400 outline-none shadow-sm transition"
                />
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <button
                    type="submit"
                    className="absolute right-2 top-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition"
                >
                    Tìm kiếm
                </button>
            </form>

            {/* Search Results Area */}
            {isSearching && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                    <h2 className="text-lg font-bold text-slate-800">Kết quả tìm kiếm ({searchResults.length})</h2>
                    {searchResults.length === 0 ? (
                        <p className="text-slate-500 text-sm">Không tìm thấy nhóm nào phù hợp với từ khóa.</p>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {searchResults.map((g) => (
                                <Link
                                    key={g.id}
                                    to={`/groups/${g.id}`}
                                    className="flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-100 rounded-xl transition group"
                                >
                                    <div className="flex items-center space-x-3.5 min-w-0">
                                        <img
                                            src={g.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${g.name}`}
                                            alt={g.name}
                                            className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                                        />
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-slate-800 group-hover:text-blue-600 transition truncate">{g.name}</h4>
                                            <p className="text-xs text-slate-400 mt-0.5 flex items-center space-x-1.5">
                                                {g.privacy === "public" ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                                <span>{g.privacy === "public" ? "Công khai" : "Riêng tư"}</span>
                                                <span>•</span>
                                                <span>{g._count?.members || 0} thành viên</span>
                                            </p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition shrink-0 ml-2" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Joined Groups List */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Nhóm đã tham gia</h3>
                {loading ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {[1, 2].map((i) => (
                            <div key={i} className="animate-pulse bg-white p-5 border border-slate-200 rounded-2xl h-24" />
                        ))}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="bg-white p-8 text-center border border-slate-200 rounded-2xl">
                        <p className="text-slate-500 text-sm">Bạn chưa tham gia bất kỳ nhóm nào.</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-4 inline-flex items-center space-x-1.5 text-blue-600 hover:text-blue-700 font-semibold text-sm cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Tạo nhóm của riêng bạn ngay</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {groups.map((g) => (
                            <Link
                                key={g.id}
                                to={`/groups/${g.id}`}
                                className="flex items-center justify-between p-5 bg-white hover:shadow-md hover:border-blue-200/80 border border-slate-200/80 rounded-2xl transition duration-200 group"
                            >
                                <div className="flex items-center space-x-4 min-w-0">
                                    <img
                                        src={g.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${g.name}`}
                                        alt={g.name}
                                        className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
                                    />
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition truncate">{g.name}</h4>
                                        <p className="text-slate-500 text-xs mt-1 line-clamp-1">{g.description || "Không có mô tả cho nhóm này."}</p>
                                        <p className="text-xs text-slate-400 mt-1.5 flex items-center space-x-1.5">
                                            {g.privacy === "public" ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                            <span>{g.privacy === "public" ? "Công khai" : "Riêng tư"}</span>
                                            <span>•</span>
                                            <span>{g._count?.members || 0} thành viên</span>
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition shrink-0 ml-2" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Group Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl p-6 md:p-8 animate-scale-up space-y-6">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">Tạo nhóm thảo luận mới</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl outline-none cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleCreateGroup} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-slate-700 text-sm font-semibold">Tên nhóm <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ví dụ: Lập trình Node.js & React"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-4 py-2.5 text-slate-800 outline-none transition text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-slate-700 text-sm font-semibold">Mô tả nhóm</label>
                                <textarea
                                    placeholder="Giới thiệu mục tiêu và quy tắc hoạt động của nhóm..."
                                    rows="3"
                                    value={groupDesc}
                                    onChange={(e) => setGroupDesc(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-4 py-2.5 text-slate-800 outline-none transition text-sm resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-slate-700 text-sm font-semibold">Chế độ riêng tư</label>
                                    <select
                                        value={groupPrivacy}
                                        onChange={(e) => setGroupPrivacy(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-slate-800 outline-none transition text-sm cursor-pointer"
                                    >
                                        <option value="public">Công khai (Public)</option>
                                        <option value="private">Riêng tư (Private)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-slate-700 text-sm font-semibold">Quy tắc đăng bài</label>
                                    <select
                                        value={postApproval ? "true" : "false"}
                                        onChange={(e) => setPostApproval(e.target.value === "true")}
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-slate-800 outline-none transition text-sm cursor-pointer"
                                    >
                                        <option value="true">Admin duyệt bài đăng</option>
                                        <option value="false">Đăng trực tiếp tự do</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3 pt-4 border-t border-slate-100 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 font-medium rounded-xl text-sm transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                                >
                                    {createLoading ? "Đang tạo..." : "Tạo nhóm"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Groups;
