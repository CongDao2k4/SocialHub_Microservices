import axios from "axios";

const getBaseURL = () => {
    const rawUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
    return rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;
};

const api = axios.create({
    baseURL: getBaseURL(),
    headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "any-value"
    }
})

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        // Luôn đảm bảo header bypass ngrok warning tồn tại trong MỌI request
        // (kể cả multipart/form-data vì headers object có thể bị override)
        config.headers["ngrok-skip-browser-warning"] = "any-value";

        // Nếu gửi FormData (upload file), ta cần xóa Content-Type mặc định (application/json)
        // để trình duyệt tự động thiết lập Content-Type kèm boundary chính xác.
        if (config.data instanceof FormData) {
            delete config.headers["Content-Type"];
        }
        return config;
    },
    (error) => Promise.reject(error)
);

const resolveUrls = (obj) => {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            resolveUrls(obj[i]);
        }
        return obj;
    }

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            if (typeof val === "string") {
                const lowerKey = key.toLowerCase();
                if ((lowerKey === "avatarurl" || lowerKey === "avatar_url") && val) {
                    // Bỏ qua blob URLs (ảnh local đã được tạo từ URL.createObjectURL)
                    if (val.startsWith("blob:")) {
                        continue;
                    }

                    let resolvedUrl = val;
                    if (!val.startsWith("http")) {
                        const cleanVal = val.startsWith("/") ? val : `/${val}`;
                        resolvedUrl = `${api.defaults.baseURL}${cleanVal}`;
                    } else {
                        // Nếu đang chạy trên production (Vercel) nhưng avatarUrl chứa localhost hoặc domain trycloudflare/ngrok cũ trong DB, chuyển đổi về gateway đúng
                        try {
                            const currentOrigin = new URL(api.defaults.baseURL).origin;
                            const urlObj = new URL(val);
                            if (urlObj.origin !== currentOrigin && val.includes("/media/file/")) {
                                const mediaId = val.split("/media/file/").pop().split("?")[0];
                                resolvedUrl = `${api.defaults.baseURL}/media/file/${mediaId}`;
                            }
                        } catch (e) {
                            // Bỏ qua nếu url không đúng định dạng
                        }
                    }

                    // Thêm tham số thời gian để tránh trình duyệt cache ảnh đại diện
                    // (chỉ áp dụng cho URL server, không phải blob URL)
                    if (!resolvedUrl.includes(`t=`)) {
                        resolvedUrl += (resolvedUrl.includes("?") ? "&" : "?") + `t=${Date.now()}`;
                    }

                    console.log(`[AVATAR_RESOLVER] Key: "${key}", Original: "${val}", Resolved: "${resolvedUrl}"`);

                    obj[key] = resolvedUrl;
                }
            } else if (typeof val === "object" && val !== null) {
                resolveUrls(val);
            }
        }
    }
    return obj;
};

// 2. Response Interceptor: Tự động giải quyết URL ảnh đại diện và làm mới Token khi nhận lỗi 401
api.interceptors.response.use(
    (response) => {
        if (response.data) {
            resolveUrls(response.data);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        if (!originalRequest) return Promise.reject(error);

        // Kiểm tra xem request có phải là request xác thực không
        const isAuthRequest = originalRequest.url && (
            originalRequest.url.includes("/auth/login") ||
            originalRequest.url.includes("/auth/refresh") ||
            originalRequest.url.includes("/auth/register")
        );

        // Chỉ cố gắng refresh token cho các request KHÔNG phải xác thực bị lỗi 401
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem("refreshToken");
                if (!refreshToken) {
                    localStorage.removeItem("accessToken");
                    if (window.location.pathname !== "/login") {
                        window.location.href = "/login";
                    }
                    return Promise.reject(error);
                }

                // Gọi API refresh token
                const res = await axios.post(`${getBaseURL()}/auth/refresh`, {
                    refreshToken,
                }, {
                    headers: {
                        "ngrok-skip-browser-warning": "any-value"
                    }
                });
                if (res.data && res.data.success) {
                    const { accessToken: newAccess, refreshToken: newRefresh } = res.data.tokens;

                    // Lưu token mới vào LocalStorage
                    localStorage.setItem("accessToken", newAccess);
                    localStorage.setItem("refreshToken", newRefresh);

                    // Cập nhật token mới vào request bị lỗi trước đó và chạy lại
                    originalRequest.headers["Authorization"] = `Bearer ${newAccess}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                console.error("🔒 Hết hạn phiên đăng nhập (Refresh token expired):", refreshError);
                // Xóa token và buộc logout
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                if (window.location.pathname !== "/login") {
                    window.location.href = "/login";
                }
            }
        }
        return Promise.reject(error);
    }
);
export default api;
