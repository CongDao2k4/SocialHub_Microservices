import axios from "axios";

const LOCAL_BASE = "http://localhost:8080";
const CLOUD_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_CLOUD_API_URL || "https://api-local.socialhubzz.cloud";

const isHttpsEnvironment = typeof window !== "undefined" && window.location.protocol === "https:";
let currentOrigin = isHttpsEnvironment ? CLOUD_BASE : LOCAL_BASE;
let isCheckingHealth = false;

const getApiUrl = (origin) => {
    if (!origin) return "/api";
    const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    return cleanOrigin.endsWith('/api') ? cleanOrigin : `${cleanOrigin}/api`;
};

const api = axios.create({
    baseURL: getApiUrl(currentOrigin),
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "any-value"
    }
});

// Hàm chuyển đổi server linh hoạt giữa Local 8080 và Cloud Tunnel
export const switchServer = (newOrigin) => {
    if (currentOrigin === newOrigin) return;
    currentOrigin = newOrigin;
    api.defaults.baseURL = getApiUrl(newOrigin);
    console.warn(`🔄 [API ROUTER] Đã chuyển đổi kết nối API Gateway sang: ${newOrigin}`);
    window.dispatchEvent(new CustomEvent("server-switched", { detail: newOrigin }));
};

// 🌟 THUẬT TOÁN HEALTH CHECK PING CHUẨN XÁC 100%:
// Trên HTTPS (Vercel), trình duyệt chặn gọi HTTP localhost (Mixed Content), nên mặc định giữ nguyên CLOUD_BASE.
export const checkServerHealth = async () => {
    if (isHttpsEnvironment) {
        if (currentOrigin !== CLOUD_BASE) {
            switchServer(CLOUD_BASE);
        }
        return;
    }

    if (isCheckingHealth) return;
    isCheckingHealth = true;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        // Ping kiểm tra tín hiệu trực tiếp tới Gateway Localhost 8080
        const res = await fetch(`${LOCAL_BASE}/health`, {
            method: "GET",
            signal: controller.signal,
            headers: { "ngrok-skip-browser-warning": "any-value" }
        }).catch(() => null);

        clearTimeout(timeoutId);

        if (res && (res.status === 200 || res.ok)) {
            // Localhost hoạt động bình thường -> Giữ/Chuyển về Localhost 8080
            if (currentOrigin !== LOCAL_BASE) {
                console.log("✅ [HEALTH CHECK] Đã phát hiện Localhost 8080 hoạt động! Chuyển lại về Localhost.");
                switchServer(LOCAL_BASE);
            }
        } else {
            // Localhost không phản hồi (Docker tắt/chưa chạy xong) -> Tạm thời dùng Cloud Server
            if (currentOrigin !== CLOUD_BASE) {
                console.warn("⚠️ [HEALTH CHECK] Localhost 8080 không phản hồi. Tự động chuyển sang Cloud Server dự phòng...");
                switchServer(CLOUD_BASE);
            }
        }
    } catch (err) {
        if (currentOrigin !== CLOUD_BASE) {
            switchServer(CLOUD_BASE);
        }
    } finally {
        isCheckingHealth = false;
    }
};

// Kích hoạt Ping kiểm tra tín hiệu ngay khi nạp trang (chỉ với môi trường HTTP Local)
if (!isHttpsEnvironment) {
    checkServerHealth();
    setInterval(() => {
        if (currentOrigin !== LOCAL_BASE) {
            checkServerHealth();
        }
    }, 8000);
}

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        config.headers["ngrok-skip-browser-warning"] = "any-value";

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
                    if (val.startsWith("blob:")) continue;

                    const getMediaBase = () => {
                        // Media luôn đi qua Gateway: /api/media/file/... (KHÔNG strip /api)
                        const envMedia = import.meta.env.VITE_MEDIA_URL;
                        if (envMedia) return envMedia.replace(/\/$/, '');
                        if (import.meta.env.DEV) return 'http://localhost:8080/api';
                        return api.defaults.baseURL || "/api";
                    };

                    let resolvedUrl = val;
                    if (!val.startsWith("http")) {
                        const cleanVal = val.startsWith("/") ? val : `/${val}`;
                        const base = cleanVal.startsWith("/media/") ? getMediaBase() : api.defaults.baseURL;
                        resolvedUrl = `${base}${cleanVal}`;
                    } else {
                        try {
                            const mediaBase = getMediaBase();
                            const urlObj = new URL(val);
                            if (val.includes("/media/file/")) {
                                const mediaId = val.split("/media/file/").pop().split("?")[0];
                                resolvedUrl = `${mediaBase}/media/file/${mediaId}`;
                            }
                        } catch (e) {}
                    }

                    if (!resolvedUrl.includes(`t=`)) {
                        resolvedUrl += (resolvedUrl.includes("?") ? "&" : "?") + `t=${Date.now()}`;
                    }

                    obj[key] = resolvedUrl;
                }
            } else if (typeof val === "object" && val !== null) {
                resolveUrls(val);
            }
        }
    }
    return obj;
};

// Response Interceptor: Xử lý Refresh Token 401 & Health Ping khi gặp lỗi mạng
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

        // Khi gặp lỗi mạng (ERR_NETWORK), tự động kích hoạt Health Check để kiểm tra xem Localhost có bị tắt không
        const isNetworkError = !error.response || error.code === "ERR_NETWORK" || error.code === "ECONNABORTED";
        if (isNetworkError && !originalRequest._healthChecked) {
            originalRequest._healthChecked = true;
            await checkServerHealth();
            if (originalRequest.baseURL !== api.defaults.baseURL) {
                originalRequest.baseURL = api.defaults.baseURL;
                return api(originalRequest);
            }
        }

        // Xử lý refresh token khi bị lỗi 401 (Hết hạn token)
        const isAuthRequest = originalRequest.url && (
            originalRequest.url.includes("/auth/login") ||
            originalRequest.url.includes("/auth/refresh") ||
            originalRequest.url.includes("/auth/register")
        );

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

                const res = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {
                    refreshToken,
                }, {
                    headers: {
                        "ngrok-skip-browser-warning": "any-value"
                    }
                });
                if (res.data && res.data.success) {
                    const { accessToken: newAccess, refreshToken: newRefresh } = res.data.tokens;
                    localStorage.setItem("accessToken", newAccess);
                    localStorage.setItem("refreshToken", newRefresh);
                    originalRequest.headers["Authorization"] = `Bearer ${newAccess}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                console.error("🔒 Hết hạn phiên đăng nhập (Refresh token expired):", refreshError);
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
