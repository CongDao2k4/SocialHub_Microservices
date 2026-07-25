import api from "./api";

const getMediaBase = () => {
  // Media luôn đi qua Gateway: /api/media/file/... (KHÔNG strip /api)
  const envMedia = import.meta.env.VITE_MEDIA_URL;
  if (envMedia) return envMedia.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:8080/api';
  return api.defaults.baseURL || "/api";
};

export const getMediaBaseUrl = () => {
  return getMediaBase();
};

export const getMediaFileUrl = (mediaId, variant = "medium") => {
  if (!mediaId) return "";
  return `${getMediaBaseUrl()}/media/file/${mediaId}?variant=${variant}`;
};

export const getHlsUrl = (mediaId) => {
  if (!mediaId) return "";
  return `${getMediaBaseUrl()}/media/hls/${mediaId}/index.m3u8`;
};
