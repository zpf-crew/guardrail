# Guardrail

---

## 🇻🇳 Tiếng Việt

### Vấn đề

Hầu hết các team phát triển không thực sự biết testing health của mình đang ở mức nào: test nào còn thiếu, test nào yếu, hay test nào là fake test — chạy pass nhưng không thật sự verify đúng behavior của hệ thống. Vì vậy, bug vẫn có thể lọt qua code review và lên production.

### Người dùng

Software engineer, Tech Lead, QA và reviewer đang làm việc trên các repository hiện có.

### Cách Guardrail giải quyết

Guardrail kết nối với GitHub, scan repository và tự động đánh giá testing health. Ngoài source code, hệ thống còn có thể phân tích documentation, QC test cases và các tài liệu nghiệp vụ liên quan để hiểu business context của sản phẩm. Đối với UI testing, Guardrail có thể sử dụng browser như một QC thực sự: tự động thực hiện các user flows, tương tác với giao diện, xác minh behavior và đối chiếu với yêu cầu nghiệp vụ. Từ đó, Guardrail xác định các khu vực chưa được test đầy đủ, các test yếu hoặc đáng ngờ, rồi đề xuất và generate test một cách an toàn, có kiểm soát trước khi code được ship.

### Giá trị mang lại

Tăng độ tin cậy của test suite, giảm bug lọt ra production, tiết kiệm thời gian viết và review test thủ công — giúp team tự tin chứng minh rằng những behavior quan trọng đã được test trước mỗi lần thay đổi.

### Kế hoạch mở rộng

Bắt đầu từ testing health và UI testing trên web applications, Guardrail sẽ tiếp tục mở rộng sang Unit Test Generation, Mobile App Testing và các hình thức kiểm thử tự động khác, hướng tới trở thành AI Testing Agent toàn diện cho toàn bộ vòng đời phát triển phần mềm.

---

## 🇬🇧 English

### Problem

Most teams don't truly know their testing health — which tests are missing, which are weak, and which are "fake" (passing green but not actually verifying behavior). Bugs slip past review and reach production.

### Users

Software engineering teams, leads/QA, and reviewers working on existing repositories.

### How Guardrail Solves It

Guardrail connects to GitHub, scans the repository, and automatically assesses testing health. Beyond source code, it can also ingest documentation, QC test cases, and other business artifacts to understand the product's business context. For UI testing, Guardrail can operate a browser like a real QA engineer — executing user flows, interacting with the application, validating behavior, and comparing outcomes against business requirements. Using this context, Guardrail surfaces untested areas, weak tests, and suspicious tests, then safely proposes and generates automated tests under your control before code ships.

### Value Delivered

Higher confidence in the test suite, fewer production bugs, and less time spent writing and auditing tests by hand — so the team can prove the right behavior is tested before every change.

### Roadmap

Starting with testing health analysis and web UI testing, Guardrail will expand into Unit Test Generation, Mobile App Testing, and additional automated testing capabilities, with the long-term vision of becoming a comprehensive AI Testing Agent across the software development lifecycle.

---

## Development

For setup instructions and local development, please refer to **DEVELOPMENT.md**.
