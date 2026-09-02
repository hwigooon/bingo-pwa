# Supabase 온라인 멀티플레이 설정 가이드

이 문서는 `bingo-pwa`를 처음 설정하는 사람을 위한 순서형 안내입니다. 아래 1~6단계를 마치면 한 휴대폰에서 온라인 방을 만들고, 다른 휴대폰에서 초대 링크로 참가할 수 있습니다.

## 준비물

- GitHub 저장소: `hwigooon/bingo-pwa`
- 무료 Supabase 계정
- GitHub 저장소의 Settings를 변경할 권한

OpenAI API 키는 필수가 아닙니다. AI 단어 추천을 사용하지 않아도 온라인 방과 실시간 빙고는 동작합니다.

## 1. Supabase 프로젝트 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인합니다.
2. **New project**를 누릅니다.
3. Organization을 고르고 다음을 입력합니다.
   - Project name: `bingo-pwa`
   - Database password: 임의의 강한 비밀번호
   - Region: 한국에서 가까운 지역
4. **Create new project**를 누르고 프로젝트 준비가 끝날 때까지 기다립니다.

데이터베이스 비밀번호는 GitHub Pages 설정에는 사용하지 않습니다. 별도로 안전하게 보관하세요.

## 2. 익명 로그인 켜기

이 게임은 회원가입 화면 대신 기기마다 임시 사용자를 자동 생성합니다.

1. 왼쪽 메뉴에서 **Authentication**을 엽니다.
2. **Sign In / Providers** 또는 **Providers**를 엽니다.
3. **Anonymous**를 선택합니다.
4. **Enable anonymous sign-ins**를 켜고 저장합니다.

익명 사용자는 브라우저 데이터를 삭제하면 기존 사용자 신분을 잃습니다. 게임 기록의 영구 계정 기능은 추후 별도 로그인을 추가해야 합니다.

## 3. 게임용 테이블과 보안 정책 만들기

1. 이 저장소에서 [`supabase/migrations/20260902000000_init_bingo.sql`](supabase/migrations/20260902000000_init_bingo.sql)을 엽니다.
2. 파일의 SQL 전체를 복사합니다.
3. Supabase 왼쪽 메뉴에서 **SQL Editor**를 엽니다.
4. **New query**를 누르고 복사한 SQL을 붙여 넣습니다.
5. **Run**을 누릅니다.
6. `Success. No rows returned`가 표시되는지 확인합니다.

이 SQL은 다음을 한 번에 설정합니다.

- `games`, `game_players`, `game_events` 테이블
- 사용자별 접근을 제한하는 RLS 정책
- 실시간 변경 알림을 위한 `supabase_realtime` publication

확인 방법:

1. **Table Editor**에서 위 3개 테이블이 보이는지 확인합니다.
2. **Database → Replication** 또는 Realtime publication 화면에서 위 3개 테이블이 포함됐는지 확인합니다.

같은 SQL을 두 번 실행하면 `already exists` 오류가 날 수 있습니다. 최초 한 번만 실행하세요.

## 4. Project URL과 Publishable key 찾기

1. 프로젝트 상단의 **Connect**를 누릅니다.
2. Project URL을 복사합니다. 형식은 `https://xxxxx.supabase.co`입니다.
3. Publishable key를 복사합니다. 보통 `sb_publishable_...`로 시작합니다.

Connect 화면에서 찾기 어렵다면 **Project Settings → API Keys**에서도 확인할 수 있습니다.

이 프로젝트의 환경변수 이름은 기존 호환성을 위해 `VITE_SUPABASE_ANON_KEY`이지만, 값에는 최신 **Publishable key**를 넣어도 됩니다.

절대로 `sb_secret_...`, `service_role` 또는 Secret key를 GitHub에 등록하지 마세요. 브라우저에 포함되면 전체 데이터가 노출될 수 있습니다.

## 5. GitHub Actions Secret 등록하기

1. [bingo-pwa 저장소](https://github.com/hwigooon/bingo-pwa)를 엽니다.
2. **Settings → Secrets and variables → Actions**로 이동합니다.
3. **New repository secret**을 눌러 아래 두 개를 각각 만듭니다.

| Secret 이름 | 입력할 값 |
|---|---|
| `VITE_SUPABASE_URL` | 4단계에서 복사한 Project URL |
| `VITE_SUPABASE_ANON_KEY` | 4단계에서 복사한 Publishable key |

Secret 이름은 대소문자까지 표와 정확히 같아야 합니다.

## 6. 다시 배포하고 온라인 연결 확인하기

Secret을 등록해도 이미 배포된 파일은 자동으로 바뀌지 않으므로 GitHub Actions를 한 번 다시 실행해야 합니다.

1. [Deploy Bingo PWA 워크플로 화면](https://github.com/hwigooon/bingo-pwa/actions/workflows/deploy-pages.yml)을 직접 엽니다.
2. 화면 오른쪽 위의 **Run workflow** 드롭다운을 누릅니다. 저장소 전체 Actions 목록 화면에는 이 버튼이 보이지 않습니다.
3. Branch가 `main`인지 확인한 다음, 드롭다운 안의 초록색 **Run workflow** 버튼을 한 번 더 누릅니다.
4. 약 1~3분 뒤 초록색 체크 표시가 나타나는지 확인합니다.
5. [배포된 Bingo PWA](https://hwigooon.github.io/bingo-pwa/)를 새로 엽니다.
6. 상단 상태가 온라인 사용 가능으로 표시되는지 확인합니다.

### `Run workflow` 버튼이 보이지 않을 때

- GitHub에 `hwigooon` 계정으로 로그인되어 있는지 확인합니다.
- 휴대폰에서는 브라우저 메뉴에서 **데스크톱 웹 사이트 요청**을 선택하면 버튼을 찾기 쉽습니다.
- 저장소에 쓰기 권한이 없는 계정에서는 버튼이 표시되지 않습니다.
- 이 워크플로는 `main` 브랜치가 변경될 때도 자동 실행됩니다. README 등 파일을 수정해 커밋해도 동일하게 재배포됩니다.

브라우저가 이전 PWA 파일을 캐시했다면 페이지를 완전히 닫았다 다시 열거나, Safari/Chrome에서 새로고침하세요.

## 휴대폰 두 대로 최종 테스트

1. 첫 번째 휴대폰에서 닉네임을 입력합니다.
2. **새 빙고 만들기**에서 빙고판을 채웁니다.
3. **온라인 방 만들기**를 누릅니다.
4. 대기 화면의 **링크 복사** 또는 **공유**를 누릅니다.
5. 두 번째 휴대폰에서 초대 링크를 엽니다.
6. 방 코드가 자동 입력되면 닉네임을 넣고 참가합니다.
7. 첫 번째 휴대폰의 참가자 목록에 두 번째 사용자가 나타나면 연결 성공입니다.
8. 방장이 게임을 시작하고 양쪽에서 칸을 눌러 실시간 현황을 확인합니다.

## 자주 발생하는 문제

### 앱에 “온라인 연결 필요”가 계속 표시됨

- GitHub Secret 두 개의 이름을 확인합니다.
- Secret 등록 후 Actions를 다시 실행했는지 확인합니다.
- Actions의 **Build** 단계가 성공했는지 확인합니다.

### `Anonymous sign-ins are disabled` 오류

Supabase의 **Authentication → Providers → Anonymous**가 활성화되지 않은 상태입니다.

### `relation games does not exist` 오류

3단계의 migration SQL이 실행되지 않았거나 다른 Supabase 프로젝트에서 실행됐습니다.

### `permission denied` 또는 참가자/게임이 보이지 않음

- migration SQL 실행 결과에 오류가 없었는지 확인합니다.
- **Table Editor**에서 세 테이블의 RLS가 활성화되어 있는지 확인합니다.
- 프로젝트의 Data API 설정에서 `public` schema가 노출되어 있는지 확인합니다.

### 방은 생성되지만 다른 휴대폰에서 참가할 수 없음

- 두 휴대폰이 같은 Supabase Project URL을 사용하는 최신 배포본인지 확인합니다.
- 방장이 게임을 이미 시작했다면 새 참가가 차단됩니다. `waiting` 상태에서 참가해야 합니다.
- 초대 링크가 `https://hwigooon.github.io/bingo-pwa/?room=방코드` 형식인지 확인합니다.

### 실시간 목록 갱신이 느림

SQL의 마지막 `alter publication supabase_realtime add table ...` 세 줄이 성공했는지 확인합니다. 실시간 연결이 일시적으로 끊겨도 화면을 새로고침하면 DB의 최신 상태를 다시 불러옵니다.

## AI 단어 추천은 나중에 설정해도 됩니다

온라인 멀티플레이에 필요한 것은 1~6단계뿐입니다. 기본 사전에 없는 주제를 AI가 추천하도록 만들 때만 Supabase Edge Function과 OpenAI API 키 설정이 추가로 필요합니다.
