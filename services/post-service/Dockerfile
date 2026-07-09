FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]


# # 1. Sử dụng Alpine base image để giữ kích thước container siêu nhỏ
# FROM node:18-alpine

# # 2. Cài đặt 'tini' để quản lý vòng đời process, giúp giải phóng RAM ngay khi stop
# RUN apk add --no-cache tini

# # 3. Thiết lập thư mục làm việc
# WORKDIR /usr/src/app

# # 4. Chuyển quyền sở hữu thư mục cho user 'node' (non-root) để tăng tính bảo mật
# RUN chown -R node:node /usr/src/app
# USER node

# # 5. Chỉ copy các file package trước để tận dụng Docker Cache layer
# COPY --chown=node:node package*.json ./

# # 6. Dùng 'npm ci' và '--omit=dev' để cài đặt nhanh, chuẩn xác và không tải thư viện dev
# RUN npm ci --omit=dev

# # 7. Copy toàn bộ mã nguồn vào container
# COPY --chown=node:node . .

# # 8. Cấu hình biến môi trường Production và ép V8 Engine giới hạn RAM (128MB)
# ENV NODE_ENV=production
# ENV NODE_OPTIONS="--max-old-space-size=128"
# ENV PORT=5000

# EXPOSE 5000

# # 9. Sử dụng tini làm Entrypoint
# ENTRYPOINT ["/sbin/tini", "--"]

# # 10. Chạy trực tiếp bằng lệnh node thay vì npm start
# CMD ["node", "src/index.js"]