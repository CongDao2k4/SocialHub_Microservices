import axios from "axios";

const getBaseURL = () => {
    return (import.meta.env.VITE_API_URL || "http://localhost:8080") + '/api';
};

const api = axios.create({
    baseURL: getBaseURL(),
    headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "any-value"
    }
})

// 1. Request Interceptor: Tự động đính Access Token vào Header nếu có
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
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
                    let resolvedUrl = val;
                    if (!val.startsWith("http")) {
                        const cleanVal = val.startsWith("/") ? val : `/${val}`;
                        resolvedUrl = `${api.defaults.baseURL}${cleanVal}`;
                    } else if (val.includes("localhost:") && !window.location.hostname.includes("localhost")) {
                        // Nếu đang chạy trên production (Vercel) nhưng avatarUrl chứa localhost, chuyển đổi về gateway đúng
                        if (val.includes("/media/file/")) {
                            const mediaId = val.split("/media/file/").pop();
                            resolvedUrl = `${api.defaults.baseURL}/media/file/${mediaId}`;
                        }
                    }

                    // Nếu URL phân giải sử dụng ngrok, đính kèm query parameter để bỏ qua trang cảnh báo của ngrok
                    if (resolvedUrl && resolvedUrl.includes("ngrok")) {
                        resolvedUrl += resolvedUrl.includes("?") ? "&ngrok-skip-browser-warning=true" : "?ngrok-skip-browser-warning=true";
                    }

                    // Thêm tham số thời gian để tránh trình duyệt cache ảnh đại diện
                    resolvedUrl += (resolvedUrl.includes("?") ? "&" : "?") + `t=${Date.now()}`;

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

        // Kiểm tra xem request có phải là request xác thực không
        const isAuthRequest = originalRequest.url.includes("/auth/login") ||
            originalRequest.url.includes("/auth/refresh") ||
            originalRequest.url.includes("/auth/register");

        // Chỉ cố gắng refresh token cho các request KHÔNG phải xác thực bị lỗi 401
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
            originalRequest._retry = true;
            try {

                const refreshToken = localStorage.getItem("refreshToken");
                if (!refreshToken) throw new Error("No refresh token available");

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
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);
export default api;
