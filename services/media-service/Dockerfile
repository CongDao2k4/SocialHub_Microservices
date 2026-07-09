# Sử dụng base image Node.js (Bản slim để tránh lỗi DNS của Alpine)
FROM node:18-slim

# Cài đặt thư mục làm việc bên trong Container
WORKDIR /app

# Copy các file khai báo thư viện trước
COPY package*.json ./

# Cài đặt thư viện (Chỉ cài các gói cần cho chạy thực tế, bỏ qua gói dev)
RUN npm install --omit=dev

# Copy toàn bộ thư mục mã nguồn (src) vào trong container
COPY src ./src

# Mở cổng 5000 (Khớp với config.PORT của chúng ta)
EXPOSE 5000

# Lệnh khởi chạy server
CMD ["node", "src/server.js"]


