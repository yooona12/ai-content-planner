# AI 콘텐츠 플래너

유튜브 크리에이터를 위한 AI 영상 기획 자동화 툴

**배포 링크 →** [https://ai-content-planner-phi.vercel.app](https://ai-content-planner-phi.vercel.app)

---

## 프로젝트 소개

키워드 하나만 입력하면 영상 제목 3안, 썸네일 컨셉, 대본 구조, 영상 컨셉을 Google Gemini AI가 자동으로 생성해주는 웹 애플리케이션입니다.

채널 장르, 타겟 시청자, 영상 톤을 설정하면 채널 성격에 맞는 맞춤형 기획안을 만들어줍니다. 결과물은 PDF로 저장할 수 있어 실제 제작 워크플로우에 바로 활용할 수 있습니다.

## 만든 이유

직접 영상을 편집하면서 기획 단계에서 소비되는 시간이 얼마나 큰지 체감했습니다. 제목 고르기, 썸네일 방향 잡기, 대본 흐름 구성 — 이 과정이 편집보다 더 오래 걸리는 경우도 많습니다.

크리에이터 입장에서 "실제로 필요한 것"이 무엇인지 알기 때문에, AI를 단순 텍스트 생성기로 쓰는 게 아니라 기획 사고 흐름 자체를 자동화하는 방향으로 설계했습니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| 기획안 자동 생성 | 키워드 입력 시 제목 3안 · 썸네일 컨셉 · 대본 구조 · 영상 컨셉 동시 생성 |
| 채널 맞춤 설정 | 장르(브이로그 · 정보 · 리뷰 등) · 타겟 시청자 · 영상 톤 설정 |
| PDF 저장 | 생성된 기획안 전체를 PDF로 저장해 바로 활용 가능 |

## 기술 스택

- **프론트엔드** React, Vite
- **AI** Google Gemini API (`gemini-2.5-flash-lite`)
- **배포** Vercel

## 로컬 실행 방법

**1. 저장소 클론**

```bash
git clone https://github.com/yooona12/ai-content-planner.git
cd ai-content-planner
```

**2. 패키지 설치**

```bash
npm install
```

**3. 환경 변수 설정**

`.env.example`을 복사해 `.env` 파일을 만들고 Gemini API 키를 입력합니다.

```bash
cp .env.example .env
```

```
VITE_GEMINI_API_KEY=your_api_key_here
```

Gemini API 키는 [Google AI Studio](https://aistudio.google.com)에서 발급받을 수 있습니다.

**4. 개발 서버 실행**

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

## 라이선스

MIT
