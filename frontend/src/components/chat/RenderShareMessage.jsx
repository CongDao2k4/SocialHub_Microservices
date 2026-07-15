import ChatMedia from "./ChatMedia";

// Component hiển thị tin nhắn chia sẻ bài viết đẹp mắt tương tự Facebook
const RenderShareMessage = ({ msgContent, isMe, onNavigate }) => {
    let data = null;
    try {
        data = JSON.parse(msgContent);
    } catch (e) {
        return <div className="text-xs italic text-slate-400">Tin nhắn chia sẻ (Không tải được nội dung)</div>;
    }

    return (
        <div className={`flex flex-col space-y-1.5 max-w-[300px] ${isMe ? "items-end" : "items-start"}`}>
            {/* Lời dẫn đi kèm (nếu có) */}
            {data.shareText && (
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
                    isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white text-slate-800 rounded-bl-none border border-slate-200"
                }`}>
                    {data.shareText}
                </div>
            )}

            {/* Block bài viết chia sẻ kiểu Facebook */}
            <div
                onClick={() => onNavigate(`/post/${data.postId}`)}
                className="bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-slate-100 rounded-2xl overflow-hidden shadow-sm cursor-pointer transition duration-200 text-left w-full max-w-[285px] flex flex-col"
            >
                {/* Phần hình ảnh ở trên */}
                {data.mediaId ? (
                    <div className="w-full h-40 overflow-hidden bg-black/5 flex items-center justify-center border-b border-slate-200/60 relative shrink-0">
                        <ChatMedia mediaId={data.mediaId} isThumbnailOnly={true} />
                        <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 max-w-[90%] select-none">
                            <img
                                src={data.authorAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.postId}`}
                                className="w-4 h-4 rounded-full object-cover border border-white/30"
                                alt="Author"
                            />
                            <span className="font-semibold text-xs text-white truncate">{data.authorName}</span>
                        </div>
                    </div>
                ) : null}

                {/* Phần nội dung text và logo ở dưới */}
                <div className="p-3.5 space-y-2">
                    {!data.mediaId && (
                        <div className="flex items-center space-x-2 border-b border-slate-200/60 pb-2">
                            <img
                                src={data.authorAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.postId}`}
                                className="w-6 h-6 rounded-full object-cover border border-slate-200"
                                alt="Author"
                            />
                            <span className="font-bold text-xs text-slate-800 truncate">{data.authorName}</span>
                        </div>
                    )}

                    {data.postContent && (
                        <p className="text-xs text-slate-700 font-normal line-clamp-3 leading-relaxed whitespace-pre-wrap">
                            {data.postContent}
                        </p>
                    )}

                    <div className="pt-1.5 flex items-center space-x-1.5 border-t border-slate-200/40">
                        <img src="/logo.svg" alt="SocialHub Logo" className="w-3.5 h-3.5 object-contain" />
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">SocialHub Post</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RenderShareMessage;
