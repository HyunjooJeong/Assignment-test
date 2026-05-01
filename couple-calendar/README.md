# 커플 캘린더 (Couple Calendar)

파트너와 함께 일정을 공유하고 실시간으로 동기화하는 공유 캘린더 애플리케이션입니다.

## 🎯 요구사항 구현

### 기본 기능
✅ 사용자가 파트너와 초대 코드로 연결  
✅ 연결된 두 사용자가 하나의 `couple_id` 공유  
✅ 모든 이벤트는 `couple_id` 기반으로 저장 및 조회  
✅ 한 사용자의 이벤트가 파트너 캘린더에 자동 표시  
✅ 이벤트에 `created_by` 필드로 작성자 기록  
✅ 사용자 및 파트너 모두 이벤트 생성/수정/삭제 가능  

### 추가 요구사항
✅ 초대 코드 생성 및 수락 API  
✅ 두 사용자를 `couple_id`로 연결하는 API  
✅ `couple_id` 기반 이벤트 조회 API  
✅ Server-Sent Events(SSE)를 통한 실시간 동기화  
✅ 한국어 프론트엔드 페이지  

## 📁 프로젝트 구조

```
couple-calendar/
├── server.js              # Node.js HTTP 서버 (모든 API)
├── package.json           # 프로젝트 메타데이터
├── README.md              # 이 파일
├── data.json              # 데이터 저장소 (자동 생성)
└── public/
    ├── index.html         # 메인 UI 페이지
    ├── app.js             # 프론트엔드 로직
    └── style.css          # 스타일시트
```

## 🚀 사용법

### 1. 서버 시작
```bash
cd couple-calendar
node server.js
```

서버는 `http://localhost:3000`에서 실행됩니다.

### 2. 브라우저 접속
```
http://localhost:3000
```

### 3. 사용 흐름
1. **사용자 생성**: 이름과 이메일 입력
2. **초대 코드 생성**: "초대 코드 생성" 버튼 클릭
3. **파트너 연결**: 파트너가 초대 코드 입력 → 자동으로 `couple_id` 연결
4. **일정 관리**: 이벤트 추가/수정/삭제 → 파트너에게 실시간 동기화

## 📡 API 엔드포인트

### 사용자 관리

**사용자 생성**
```
POST /api/users
Content-Type: application/json

{
  "name": "홍길동",
  "email": "hong@example.com"
}
```

**사용자 조회**
```
GET /api/users/:id
```

### 파트너 연결

**초대 코드 생성**
```
POST /api/invite
{
  "user_id": 1
}

응답:
{
  "couple_id": 1,
  "invite_code": "ABC12345"
}
```

**초대 코드 수락**
```
POST /api/invite/accept
{
  "user_id": 2,
  "invite_code": "ABC12345"
}
```

### 이벤트 관리

**이벤트 조회 (couple_id 기반)**
```
GET /api/events?couple_id=1
```

**이벤트 생성**
```
POST /api/events
{
  "couple_id": 1,
  "title": "데이트",
  "description": "영화 보기",
  "start": "2026-05-01T19:00",
  "end": "2026-05-01T21:00",
  "created_by": 1
}
```

**이벤트 수정**
```
PUT /api/events/:id
{
  "title": "수정된 제목",
  "description": "수정된 설명",
  "start": "2026-05-02T19:00",
  "end": "2026-05-02T21:00"
}
```

**이벤트 삭제**
```
DELETE /api/events/:id
```

### 실시간 동기화

**Server-Sent Events 연결**
```
GET /api/events/stream?couple_id=1

응답: text/event-stream
data: {"type":"created","event":{...}}
```

## 💾 데이터 저장

- 모든 데이터는 `data.json` 파일에 JSON 형식으로 저장
- 서버 재시작 시에도 데이터 유지
- 파일 자동 생성 (첫 실행 시)

## 🛠️ 기술 스택

- **백엔드**: Node.js (표준 HTTP 모듈, 외부 의존성 없음)
- **프론트엔드**: Vanilla JavaScript (프레임워크 없음)
- **저장소**: JSON 파일
- **실시간**: Server-Sent Events (SSE)

## 📝 주요 구현 사항

### Couple 모델
```javascript
{
  couple_id: 1,
  invite_code: "ABC12345",
  created_at: "2026-04-30T..."
}
```

### User 모델
```javascript
{
  id: 1,
  name: "홍길동",
  email: "hong@example.com",
  created_at: "2026-04-30T..."
}
```

### Event 모델
```javascript
{
  id: 1,
  couple_id: 1,
  title: "데이트",
  description: "영화 보기",
  start: "2026-05-01T19:00",
  end: "2026-05-01T21:00",
  created_by: 1,
  created_at: "2026-04-30T...",
  updated_at: "2026-04-30T..."
}
```

## ⚠️ 주의사항

- 이 구현은 **MVP(최소 기능 제품)** 단계입니다.
- 실제 프로덕션에서는 다음이 필요합니다:
  - 데이터베이스 (SQLite, PostgreSQL 등)
  - 인증 & 보안 시스템 (JWT, OAuth)
  - 입력 검증 강화
  - 에러 처리 개선
  - 테스트 코드
  - 로깅 시스템

## 📄 라이선스

MIT

---

**팀 과제용 커플 캘린더 - 한국어 버전**
