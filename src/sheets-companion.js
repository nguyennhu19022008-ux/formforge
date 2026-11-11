/**
 * FormForge - Google Apps Script (GAS) Companion Template
 * Reverse-engineered script for Google Sheets / Google Forms automation & audit analysis.
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * FORMFORGE GOOGLE APPS SCRIPT COMPANION
 * Dành cho Chủ sở hữu Form kiểm thử, phân tích dữ liệu & rà soát dấu vết số
 * ============================================================================
 */

/**
 * 1. HÀM TẠO PHIẾU KHẢO SÁT NỘI BỘ (Chạy trực tiếp trên Google Form Editor)
 * Mở Google Form -> Tiện ích mở rộng -> Apps Script -> Dán hàm này vào
 */
function simulateInternalFormResponses(targetCount = 10) {
  var form = FormApp.getActiveForm();
  var items = form.getItems();
  Logger.log("Bắt đầu sinh phiếu cho form: " + form.getTitle() + " (Số lượng: " + targetCount + ")");

  for (var i = 0; i < targetCount; i++) {
    var formResponse = form.createResponse();

    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var itemType = item.getType();

      if (itemType === FormApp.ItemType.MULTIPLE_CHOICE) {
        var mcItem = item.asMultipleChoiceItem();
        var choices = mcItem.getChoices();
        if (choices.length > 0) {
          // Chọn ngẫu nhiên 1 phương án
          var randomChoice = choices[Math.floor(Math.random() * choices.length)].getValue();
          formResponse.withItemResponse(mcItem.createResponse(randomChoice));
        }
      } else if (itemType === FormApp.ItemType.SCALE) {
        var scaleItem = item.asScaleItem();
        // Giả lập Likert điểm 4 hoặc 5
        var randomScale = Math.random() > 0.3 ? 4 : 5;
        formResponse.withItemResponse(scaleItem.createResponse(randomScale));
      } else if (itemType === FormApp.ItemType.TEXT) {
        var textItem = item.asTextItem();
        formResponse.withItemResponse(textItem.createResponse("Phản hồi mẫu " + (i + 1)));
      }
    }

    // Nộp trực tiếp trên máy chủ Google (Không tốn IP, không bị Captcha)
    formResponse.submit();
    Utilities.sleep(300); // Trì hoãn nhẹ 300ms
  }

  Logger.log("Đã hoàn tất sinh " + targetCount + " phiếu.");
}

/**
 * 2. HÀM RẢI DẤU THỜI GIAN TRÊN GOOGLE SHEETS (Mô phỏng cơ chế Fake Timestamp)
 * Mở Google Sheet liên kết -> Tiện ích mở rộng -> Apps Script -> Chạy hàm này
 * Lưu ý: Hành động này sẽ được ghi lại trong Lịch sử phiên bản (Version History)
 */
function simulateTimestampSpread(startDateStr, endDateStr) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log("Chưa có dữ liệu phản hồi.");
    return;
  }

  var startDate = new Date(startDateStr || "2026-10-01T08:00:00");
  var endDate = new Date(endDateStr || "2026-10-10T21:00:00");
  var timeSpan = endDate.getTime() - startDate.getTime();

  var range = sheet.getRange(2, 1, lastRow - 1, 1);
  var values = [];

  for (var i = 0; i < lastRow - 1; i++) {
    // Sinh thời gian ngẫu nhiên tăng dần trong khoảng
    var progress = i / (lastRow - 1);
    var baseTimestamp = startDate.getTime() + (progress * timeSpan);
    var jitter = (Math.random() - 0.5) * 3600000; // Sai số +- 30 phút
    var finalDate = new Date(baseTimestamp + jitter);

    values.push([finalDate]);
  }

  // Ghi đè toàn bộ cột A
  range.setValues(values);
  Logger.log("Đã điều chỉnh dấu thời gian cho " + (lastRow - 1) + " dòng phản hồi.");
}

/**
 * 3. HÀM AUDIT: PHÁT HIỆN LỆCH PHA GIỮA THỜI GIAN SHEET VÀ GOOGLE FORM
 * Giúp người làm nghiên cứu kiểm tra xem dữ liệu có bị lộ dấu vết sửa đè hay không
 */
function auditResponseIntegrity() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  var timestamps = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  var suspiciousCount = 0;
  for (var i = 1; i < timestamps.length; i++) {
    var t1 = new Date(timestamps[i - 1][0]).getTime();
    var t2 = new Date(timestamps[i][0]).getTime();

    // Nếu thời gian nộp cách nhau dưới 3 giây
    if (Math.abs(t2 - t1) < 3000) {
      suspiciousCount++;
    }
  }

  Logger.log("=== KẾT QUẢ RÀ SOÁT DẤU VẾT ===");
  Logger.log("Tổng số phản hồi: " + (lastRow - 1));
  Logger.log("Số cặp phản hồi cách nhau dưới 3 giây (Dấu hiệu Bot spam): " + suspiciousCount);
  if (suspiciousCount > 10) {
    Logger.log("CẢNH BÁO: Dữ liệu có nguy cơ cao bị Hội đồng phát hiện là phiếu ảo.");
  } else {
    Logger.log("Độ rải thời gian tương đối tự nhiên.");
  }
}
`;
