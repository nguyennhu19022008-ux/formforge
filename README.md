# FORMFORGE /// REVERSE-ENGINEERED AUTOMATION ENGINE
> **Bộ công cụ kiểm thử tự động, bóc tách Schema Google Form, mô phỏng phản hồi SPSS/SEM & Phân tích Dấu vết số.**

Hệ thống được thiết kế theo kiến trúc Cloud-First hiện đại, triển khai trên Vercel Serverless, hỗ trợ cài đặt Progressive Web App (PWA) trên mọi thiết bị di động (Android & iOS) và máy tính mà không cần cài đặt phần mềm.

---

## 🌐 ỨNG DỤNG TRỰC TUYẾN
- **Live Production URL**: [https://formforge-ten-eta.vercel.app](https://formforge-ten-eta.vercel.app)
- **Hỗ trợ PWA**: Mở trên trình duyệt điện thoại (Chrome/Safari) và bấm **"Thêm vào màn hình chính" (Install App)** để dùng toàn màn hình như ứng dụng gốc.

---

## 🏗️ CẤU TRÚC DỰ ÁN TINH GỌN (ZERO-DEPENDENCY)

```
formforge/
├── vercel.json                # Cấu hình tối ưu định tuyến Vercel Cloud
├── package.json               # Cấu hình dự án (Zero external dependencies)
├── server.js                  # Máy chủ HTTP gốc phục vụ local & Vercel
├── api/
│   └── index.js               # Vercel Serverless API handler
├── src/
│   ├── parser.js              # Bóc tách HTML, Page History, Entry IDs, fbzx token
│   ├── generator.js           # Sinh dữ liệu: Weighted Random, Likert Covariance (SPSS/SEM)
│   ├── dispatcher.js          # Trình phát HTTP POST /formResponse (Song song đa luồng)
│   ├── auditor.js             # Thuật toán kiểm định độ tin cậy Cronbach's Alpha
│   └── sheets-companion.js    # Mã nguồn Google Apps Script (GAS) đồng hành trên Drive
├── public/
│   ├── index.html             # Giao diện Studio Dashboard (Editorial Minimalist)
│   ├── styles.css             # Giao diện tông sáng đĩnh đạc, Cardless Grid
│   ├── app.js                 # Xử lý logic Client, tính toán ETC live, audit dữ liệu
│   ├── manifest.json          # Cấu hình PWA Web App Manifest
│   └── icon.png               # Icon ứng dụng chuẩn PWA
└── bin/
    └── cli.js                 # Giao diện dòng lệnh CLI độc lập
```

---

## 🚀 KHỞI CHẠY CỤC BỘ (TÙY CHỌN)

Dự án sử dụng 100% module gốc của Node.js, **không cần cài thêm bất kỳ thư viện npm bên ngoài**:

```powershell
# Chạy máy chủ cục bộ nếu cần kiểm thử offline
node server.js
```
Truy cập: `http://localhost:3000`
