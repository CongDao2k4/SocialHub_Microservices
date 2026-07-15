# Lỗi Giao diện và chat service + gateway + query MongoDB

## 1. Truy cập giao diện và xem hoạt động qua các nút click và nhập trên html, css

- Bạn hãy truy cập website sau, tự mở trình duyệt ra mà xem , url `https://social-hub-microservices.vercel.app`

- Sau đó nó sẽ tự chuyển đến `https://social-hub-microservices.vercel.app/login` để bạn đăng nhập. Bạn hãy nhập `congdao@gmail.com` tại `div class="relative" > input required placeholder="name@example.com"` , và nhập mật khẩu `12345678` tại `div class="relative" > input reuired placeholder="••••••••"`.

- Sau khi vào được trang chủ. Bạn hãy chuyển đến url `https://social-hub-microservices.vercel.app/messages` , đây là nơi xem tin nhắn, Tại giao diện bạn sẽ thấy 1 thanh bar dọc `Hội thoại` là `div class="w-80 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0"`. Hãy thử ấn vào 1 chat với người tên là `Voldermort` ở `div class="flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition group bg-violet-50 border border-violet-200"`.

- Khi ấn xong sẽ hiển thị ra ô chat với người đó ở `div class="flex-1 flex flex-col min-w-0 bg-white"` ở cạnh bên phải ô `Hội thoại`. Khi tôi ấn vào ô nhập tin nhắn `form class="p-3 border-t border-slate-200 bg-white space-y-3 shrink-0"` để gửi ảnh, tin nhắn và ấn nút để gửi `button type="submit"` thì nó sẽ gửi tin nhắn đi => Cái này áp dụng cho cả chat 2 người và Nhóm chat.

## 2. Yêu cầu

- Bạn hãy mở url ra và làm test như tôi hướng dẫn ở `1. Truy cập giao diện và xem hoạt động qua các nút click và nhập trên html, css`. Sau đó bạn có quyền đọc code API, code logic , code event và mọi thứ ở gateway, chat-service, media-service, notification-service; bạn còn có quyền đọc log ở các docker container đang chạy.

- Hãy hiểu thật sau sẵ code logic, sự kiện, query, data, header, websocket, ... 

## 3. Vấn dề cần giải quyết

### 3.1. Vấn đề 1:

- Khi tôi ấn vào ô nhập tin nhắn `form class="p-3 border-t border-slate-200 bg-white space-y-3 shrink-0"` để gửi ảnh, tin nhắn và ấn nút để gửi `button type="submit"` thì nó sẽ gửi tin nhắn đi => Cái này áp dụng cho cả chat 2 người và Nhóm chat. Vấn đề xuất hiện là sau khi gửi tin nhắn xong thì thanh bar `Hội thoại` chứa list các cá nhân đã có tin nhắn, các nhóm chat sẽ load lại, và giao diện bên ô chat thì không bị load lại nhưng nó vẫn hiển thị tin nhắn mới gửi đi => dùng web socket cho chat service nên thế.

- Cần sửa để không load lại bar `Hội thoại`

## 3.2. Vấn đề 2:

- Khi có ai đó nhắn tin đến tôi. ở từng phần tử chat ví dụ chat với người tên là `Voldermort` ở `div class="flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition group bg-violet-50 border border-violet-200"` thì nó có 1 `span class="bg-rose-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full shadow-md shadow-rose-500/20 min-w-[16px] text-center group-hover:hidden animate-pulse"` để có  chấm đỏ hiển thị. 

- Nhưng khi tôi ấn vào chat đó và ô chat của chat đó hiện ra rồi, nút đỏ vẫn không hết. Đến khi tôi nhập tin nhắn và gửi đi thì cái chấm đỏ mới hết => Đáng nhẽ ra là từu khi tôi ấn vào chat đó là nó phải hết chấm đỏ rồi.

## 3.3. Vấn đề 3: 

- Khi có ai đó nhắn tin đến tôi. ở từng phần tử chat ví dụ chat với người tên là `Voldermort` ở `div class="flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition group bg-violet-50 border border-violet-200"` thì có đoạn  chat thì nó kéo xuống tận cùng tin nhắn mới nhất chưa cần biết của ai gửi (đúng vì chat kéo xuống tin nhắn mới nhất là oke), nhưng có lúc thì nó dừng ở lưng chừng ở vài tin nhắn chat trước đó.

- Cầ tìm hiểu kỹ nhé, có vẻ nó chưa lướt xuống tin nhắn mới nhất theo thời gian

## 3.4. Vấn đề 4: 

- Các tin nhắn được query hết, không có load theo kiểu phân tang ví dụ lấy 10 tin nhắn mới nhất. Tôi cần chỉ laod tầm 10 tin nhắn gần nhất tính tổng không cần biết ai gửi trong 1 chat 2 người hoặc chat nhóm => Sau đó nếu kéo lướt lên trên dần thì mưới load các tin nhắn cũ hơn chứ.
