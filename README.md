# FORMFORGE /// REVERSE-ENGINEERED AUTOMATION ENGINE
> **Bộ công cụ kiểm thử tự động, bóc tách Schema Google Form, mô phỏng phản hồi SPSS/SEM & Phân tích Dấu vết số.**

Hệ thống được thiết kế và tái cấu trúc dựa trên quy trình ngược từ kiến trúc của các nền tảng điền form tự động (`ezform.site`), giúp lập trình viên và nhà nghiên cứu hiểu rõ cơ chế vận hành, kiểm toán dữ liệu và rà soát các rủi ro liêm chính học thuật.

---

## 🏗️ CẤU TRÚC DỰ ÁN

```
form-automation-engine/
├── package.json               # Cấu hình dự án Node.js (Zero-dependency)
├── server.js                  # Máy chủ Web HTTP phục vụ Dashboard & REST API
├── src/
│   ├── parser.js              # Bóc tách HTML, FB_PUBLIC_LOAD_DATA_, Entry IDs, fbzx token
│   ├── generator.js           # Sinh dữ liệu: Weighted Random, Likert Covariance (SPSS/SEM)
│   ├── dispatcher.js          # Trình phát HTTP POST /formResponse (Instant vs Throttled)
│   └── sheets-companion.js    # Mã nguồn Google Apps Script (GAS) đồng hành trên Drive
├── public/
│   ├── index.html             # Giao diện Studio Dashboard trực tiếp (Light Editorial Theme)
│   ├── styles.css             # Giao diện tông sáng đĩnh đạc, chuẩn Cardless Editorial Grid
│   └── app.js                 # Xử lý logic Client, biểu đồ tiến trình live, xuất CSV
└── bin/
    └── cli.js                 # Giao diện dòng lệnh CLI độc lập
```

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY

### 1. Khởi chạy Giao diện Web Studio (Trực tiếp)

Dự án sử dụng 100% module gốc của Node.js, **không cần cài thêm bất kỳ thư viện npm bên ngoài**:

```powershell
# Di chuyển vào thư mục dự án
cd "C:\Users\Admin\.gemini\antigravity\scratch\form-automation-engine"

# Khởi động server
node server.js
```

Truy cập trên trình duyệt: **`http://localhost:3000`** (Mở thẳng vào Studio Dashboard, không còn màn hình trung gian).
- **Tab Hướng dẫn**: Quy trình 5 bước và nút "Dùng thử Form Mẫu Test" 1 chạm.
- **Tab 1: Bóc tách Schema**: Nhập URL form, bóc tách Entry ID và cờ bắt buộc đăng nhập.
- **Tab 2: Cấu hình Trọng số**: Chỉnh % từng câu hoặc bật mô hình hiệp phương sai SPSS.
- **Tab 3: Trình phát Live**: Bấm nộp phiếu, theo dõi live log độ trễ và mã HTTP.
- **Tab 4: Xuất Ma trận**: Tải file `.csv` nạp vào IBM SPSS Statistics.
- **Tab 5: GAS & Soi Dấu vết**: Mã nguồn Apps Script và 4 nguy cơ bị Hội đồng phát hiện.

---

### 2. Sử dụng qua Giao diện Dòng lệnh (CLI)

```powershell
# Chạy thử nghiệm ngay với bộ câu hỏi mẫu tích hợp sẵn
node bin/cli.js --sample --count 10 --export data_test.csv

# Kiểm tra một link Google Form thật (Chế độ Dry-run)
node bin/cli.js --url "https://docs.google.com/forms/d/e/.../viewform" --count 5 --mode dry-run
```
