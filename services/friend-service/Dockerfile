# Bước 1: Sử dụng node image alpine siêu nhẹ
FROM node:18-alpine

# Bước 2: Thiết lập thư mục làm việc trong container
WORKDIR /usr/src/app

# Bước 3: Sao chép package.json
COPY package*.json ./

# Bước 4: Cài đặt production dependencies
RUN npm install --omit=dev

# Bước 5: Sao chép mã nguồn
COPY . .

# Bước 6: Mở cổng mặc định trong container
ENV PORT=5000
EXPOSE 5000

# Bước 7: Khởi chạy
CMD ["node", "src/index.js"]


# # Bước 1: Sử dụng node image alpine
# FROM node:18-alpine

# # Cài đặt 'tini' để quản lý process (giúp dọn dẹp RAM ngay lập tức khi stop/restart container)
# RUN apk add --no-cache tini

# # Bước 2: Thiết lập thư mục làm việc
# WORKDIR /usr/src/app

# # Bước 3: Phân quyền thư mục cho user 'node' có sẵn trong image, thay vì chạy bằng root
# RUN chown -R node:node /usr/src/app

# # Chuyển sang user 'node' (non-root user)
# USER node

# # Bước 4: Sao chép package.json và package-lock.json
# COPY --chown=node:node package*.json ./

# # Bước 5: Cài đặt dependencies
# # Thay 'npm install' bằng 'npm ci' để cài đặt nhanh hơn, sạch hơn và chuẩn xác theo file lock
# RUN npm ci --omit=dev

# # Bước 6: Sao chép mã nguồn
# COPY --chown=node:node . .

# # Bước 7: Cấu hình biến môi trường
# ENV PORT=5000

# # 🔴 QUAN TRỌNG NHẤT ĐỂ GIẢM RAM: 
# # Ép V8 Engine chỉ dùng tối đa 128MB RAM cho Heap (rất phù hợp cho Express.js)
# ENV NODE_OPTIONS="--max-old-space-size=128"

# EXPOSE 5000

# # Bước 8: Khởi chạy thông qua tini
# ENTRYPOINT ["/sbin/tini", "--"]
# CMD ["node", "src/index.js"]