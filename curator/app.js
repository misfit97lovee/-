import { serviceHeader } from '../src/components/Header.js';

/* -------------------------------------------------------------
   1. Application State (5-Element Architecture)
   - 보안 조치: 프론트엔드 API 키 완전 제거
   - 브라우저 -> Express 서버(/api/recommend-books) -> .env -> Gemini
   ------------------------------------------------------------- */
const AgentState = {
  goal: "중학생 관심사 탐색 및 도서 추천 · 독서 노트 완성",
  userGrade: "중학교 1학년",
  userInterests: [], // Set of strings
  recommendedBooks: [], // Array of book objects
  currentDocument: null, // Markdown string
  chatHistory: [], // Array of { role: 'user'|'librarian', content: string }
  turnCount: 0
};

/* -------------------------------------------------------------
   2. National Library Mock Database (중학생 맞춤형 도서 20+선)
   ------------------------------------------------------------- */
const NationalLibraryDB = [
  // 과학 / 우주 / 천문
  {
    id: "NLK-001",
    title: "코스모스 (청소년을 위한 에디션)",
    author: "칼 세이건 (앤 드루얀 엮음)",
    publisher: "사이언스북스",
    callNo: "440.1-세68ㅋ",
    targetGrade: "중학교 1~2학년",
    category: "과학/우주",
    keywords: ["우주", "천문학", "블랙홀", "외계생명체", "행성", "별", "코스모스", "과학"],
    synopsis: "인류 역사상 가장 위대한 과학 고전 중 하나로, 우주의 탄생과 블랙홀의 신비, 생명의 기원을 청소년의 눈높이에 맞춰 다정하게 해설한 명저입니다.",
    coreConcepts: ["우주적 시각(Cosmic Perspective)", "빛의 속도와 시공간", "생명 진화의 우주적 연결"],
    questions: [
      "우리가 보는 밤하늘의 별빛은 수만 년 전의 과거라는 사실이 왜 시간여행과 같을까요?",
      "인간이 우주에서 티끌처럼 작은 존재라면, 왜 우리의 지적 탐구는 위대하다고 할 수 있을까요?",
      "외계 문명을 찾는 보이저호 골든 레코드에 당신이라면 어떤 지구의 소리를 담고 싶나요?"
    ]
  },
  {
    id: "NLK-002",
    title: "블랙홀 여행자를 위한 안내서",
    author: "킵 손, 닐 디그래스 타이슨 공저",
    publisher: "동아시아",
    callNo: "443.2-손74ㅂ",
    targetGrade: "중학교 1~3학년",
    category: "과학/우주",
    keywords: ["블랙홀", "상대성이론", "아인슈타인", "사건의지평선", "우주", "물리"],
    synopsis: "빛조차 빠져나올 수 없는 시공간의 심연, 블랙홀에 빨려 들어간다면 우리 몸엔 어떤 일이 일어날까? 최신 천체물리학의 정수를 흥미진진한 가상 여행으로 풀어냅니다.",
    coreConcepts: ["사건의 지평선(Event Horizon)", "시간 지연 현상", "스파게티화 현상"],
    questions: [
      "블랙홀 근처에서 시간이 지구보다 느리게 흐른다면 이를 이용해 미래로 갈 수 있을까요?",
      "빛조차 삼키는 블랙홀의 존재를 과학자들은 어떻게 사진으로 관측해냈을까요?",
      "우주의 모든 법칙이 무너지는 특이점(Singularity)은 우리에게 어떤 철학적 질문을 던질까요?"
    ]
  },
  {
    id: "NLK-003",
    title: "세상에서 가장 재미있는 17가지 원소 이야기",
    author: "엉클 텅스텐 연구팀",
    publisher: "반니",
    callNo: "430.4-엉82ㅅ",
    targetGrade: "중학교 1학년",
    category: "과학/화학",
    keywords: ["화학", "원소", "주기율표", "물질", "스마트폰", "과학"],
    synopsis: "우리가 매일 쓰는 스마트폰 안에는 어떤 희귀 원소가 숨어있을까? 연금술부터 최첨단 반도체까지 주기율표 속 원소들이 펼치는 마법 같은 이야기.",
    coreConcepts: ["원소의 주기성", "생활 속 화학", "신소재의 탄생"],
    questions: [
      "스마트폰 터치스크린을 가능하게 만든 인듐은 왜 대체 불가능한 원소로 불릴까요?",
      "주기율표를 완성하기 위해 평생을 바친 멘델레예프의 발견 방식에서 무엇을 배울 수 있을까요?",
      "지구상에서 고갈되어 가는 희토류 원소를 재활용하는 가장 현명한 방법은 무엇일까요?"
    ]
  },

  // 문학 / 성장 / 소설
  {
    id: "NLK-004",
    title: "아몬드",
    author: "손원평",
    publisher: "창비",
    callNo: "813.7-손68ㅇ",
    targetGrade: "중학교 1~3학년",
    category: "문학/청소년소설",
    keywords: ["문학", "소설", "감정", "공감", "성장", "심리", "친구", "가족"],
    synopsis: "감정을 느끼지 못하는 소년 '윤재'와 분노로 가득 찬 소년 '곤이'가 만나 서로의 상처를 보듬고 세상으로 나아가는 가슴 뭉클한 성장 소설입니다.",
    coreConcepts: ["편도체와 감정 인지", "진정한 공감의 조건", "타인을 이해하는 용기"],
    questions: [
      "감정을 느끼지 못하는 윤재에게 세상은 왜 '괴물'이라는 꼬리표를 붙였을까요?",
      "곤이의 거친 행동 뒤에 숨겨진 진짜 갈망은 무엇이었을까요?",
      "'진짜 공감'이란 상대방의 아픔을 똑같이 느끼는 것일까요, 아니면 곁에 머물러주는 것일까요?"
    ]
  },
  {
    id: "NLK-005",
    title: "모모 (Momo)",
    author: "미하엘 엔데",
    publisher: "비룡소",
    callNo: "853-엔24ㅁ",
    targetGrade: "중학교 1~2학년",
    category: "문학/철학소설",
    keywords: ["문학", "시간", "경청", "우정", "철학", "판타지", "마음"],
    synopsis: "시간을 훔쳐가는 회색 신사들과 그들에 맞서 사람들에게 잃어버린 마음과 경청의 힘을 되찾아주는 특별한 소녀 모모의 환상적인 모험 이야기.",
    coreConcepts: ["시간의 본질", "진정한 경청의 힘", "현대사회의 여유와 행복"],
    questions: [
      "회색 신사들이 시간 저축을 권유하며 빼앗아간 것은 결국 무엇이었을까요?",
      "모모처럼 '다른 사람의 말을 온마음으로 들어주는 것'만으로 어떻게 기적이 일어날 수 있을까요?",
      "내 삶에서 가장 아깝지 않게 시간을 선물하고 싶은 순간은 언제인가요?"
    ]
  },
  {
    id: "NLK-006",
    title: "시간을 파는 상점",
    author: "김선영",
    publisher: "자음과모음",
    callNo: "813.7-김54ㅅ",
    targetGrade: "중학교 1~3학년",
    category: "문학/성장소설",
    keywords: ["문학", "시간", "인터넷", "의뢰", "성장", "치유", "청소년"],
    synopsis: "인터넷 카페 '시간을 파는 상점'을 연 온조가 사람들의 다양한 시간 의뢰를 해결하며 인생에서 되돌릴 수 없는 순간들의 소중함을 깨달아가는 이야기.",
    coreConcepts: ["크로노스와 카이로스", "시간의 유한성과 선택", "연대와 위로"],
    questions: [
      "흘러가는 물리적 시간과 우리가 마음으로 느끼는 시간은 왜 다르게 흐를까요?",
      "상점에 접수된 의뢰 중 가장 기억에 남는 의뢰와 그 이유는 무엇인가요?",
      "만약 당신이 '시간을 파는 상점'에 딱 한 가지 부탁을 맡길 수 있다면 무엇을 의뢰하겠습니까?"
    ]
  },
  {
    id: "NLK-007",
    title: "기억 전달자 (The Giver)",
    author: "로이스 로우리",
    publisher: "비룡소",
    callNo: "843-로67ㄱ",
    targetGrade: "중학교 2~3학년",
    category: "SF/디스토피아",
    keywords: ["SF", "디스토피아", "기억", "자유", "통제", "감정", "선택"],
    synopsis: "전쟁도 가난도 차별도 없지만 기억과 감정마저 통제된 '늘 같음 상태'의 사회에서 홀로 인류의 과거 기억을 전수받게 된 소년 조너스의 용기 있는 탈출기.",
    coreConcepts: ["완벽한 사회의 함정", "고통 없는 삶과 행복의 관계", "자유의지의 가치"],
    questions: [
      "슬픔과 전쟁이 없는 대신 사랑과 색채도 없는 사회는 과연 유토피아일까요?",
      "기억 전달자가 조너스에게 첫 번째로 건넨 '눈(Snow)'의 기억은 조너스를 어떻게 변화시켰나요?",
      "안전과 안정, 그리고 위험하지만 자유로운 선택 중 어느 것이 인간다운 삶일까요?"
    ]
  },

  // 추리 / 미스터리
  {
    id: "NLK-008",
    title: "셜록 홈즈 전집: 주홍색 연구",
    author: "아서 코난 도일",
    publisher: "황금가지",
    callNo: "823.8-도68ㅅ",
    targetGrade: "중학교 1~3학년",
    category: "추리/고전문학",
    keywords: ["추리", "미스터리", "명탐정", "셜록홈즈", "논리", "관찰", "연역법"],
    synopsis: "탐정 소설의 불멸의 고전! 날카로운 관찰력과 연역적 추리로 런던의 미제 살인 사건을 파헤치는 홈즈와 왓슨 박사의 전설적인 첫 만남.",
    coreConcepts: ["연역적 추론 기법", "사소한 단서의 재구성", "과학 수사의 시초"],
    questions: [
      "홈즈가 왓슨을 보자마자 아프가니스탄 군의관 출신임을 알아맞힌 논리의 단계는 무엇이었나요?",
      "단순한 '보기(See)'와 본질을 꿰뚫어 보는 '관찰(Observe)'의 차이는 무엇일까요?",
      "사건의 범인이 복수를 결심하게 된 비극적 배경에 대해 정의의 관점에서 어떻게 생각하나요?"
    ]
  },

  // 인공지능 / 미래 사회 / 코딩
  {
    id: "NLK-009",
    title: "10대를 위한 인공지능 첫걸음",
    author: "김대식",
    publisher: "동아시아",
    callNo: "004.73-김23ㅇ",
    targetGrade: "중학교 1~3학년",
    category: "IT/인공지능",
    keywords: ["인공지능", "AI", "챗GPT", "로봇", "미래", "진로", "기술", "윤리"],
    synopsis: "뇌과학자 김대식 교수가 십대들에게 들려주는 생성형 AI 시대의 생존법. AI는 어떻게 생각하며, 인간만의 고유한 창의력은 어디에서 나오는가?",
    coreConcepts: ["딥러닝과 인공신경망", "AGI(일반인공지능)의 도래", "질문하는 인간의 경쟁력"],
    questions: [
      "정답을 빠르게 찾는 AI 시대에, 왜 '좋은 질문을 던지는 능력'이 가장 중요해질까요?",
      "AI가 그림을 그리고 소설을 쓰는 시대에 인간 예술가의 독창성은 어디에서 지켜질 수 있을까요?",
      "인공지능이 내린 결정에 윤리적 문제가 생겼을 때, 그 책임은 누구에게 물어야 할까요?"
    ]
  },
  {
    id: "NLK-010",
    title: "로봇 시대, 인간의 일",
    author: "구본권",
    publisher: "어크로스",
    callNo: "331.04-구45ㄹ",
    targetGrade: "중학교 2~3학년",
    category: "사회/미래학",
    keywords: ["인공지능", "로봇", "직업", "미래", "철학", "디지털", "사회"],
    synopsis: "자율주행차부터 감정 노동 로봇까지, 자동화 사회에서 청소년들이 마주할 10가지 거대한 철학적·직업적 질문을 던지는 통찰력 있는 책.",
    coreConcepts: ["디지털 리터러시", "기계와의 공존", "인간성 회복"],
    questions: [
      "로봇이 노동을 대신하는 사회에서 우리는 무엇을 통해 삶의 보람과 가치를 찾게 될까요?",
      "자율주행차의 '트로츠키 딜레마(사고 시 누구를 보호할 것인가)'를 프로그래밍하는 기준은 무엇이어야 할까요?",
      "인간과 기계의 가장 결정적인 차이는 '실수를 두려워하지 않는 용기'에 있다는 주장에 동의하나요?"
    ]
  },

  // 역사 / 사회 / 철학
  {
    id: "NLK-011",
    title: "10대를 위한 총, 균, 쇠",
    author: "재레드 다이아몬드 원작",
    publisher: "문학사상",
    callNo: "909-다68ㅊ",
    targetGrade: "중학교 2~3학년",
    category: "역사/인류학",
    keywords: ["역사", "인류학", "지리", "문명", "사회", "진화"],
    synopsis: "왜 흑인은 백인보다 기술을 늦게 발전시켰을까? 인종차별적 편견을 깨고 대륙의 지리적 환경과 환경적 요인이 인류 문명의 불평등을 낳았음을 입증한 불후의 명작.",
    coreConcepts: ["환경 결정론과 지리적 축", "동식물의 가축화/작물화", "병원균과 무기의 역사"],
    questions: [
      "대륙의 축이 동서 방향(유라시아)이냐 남북 방향(아메리카)이냐가 농업 전파에 왜 결정적 영향을 미쳤을까요?",
      "인류 문명의 불평등이 인종의 우열이 아닌 환경의 차이라는 결론은 왜 전 세계에 큰 울림을 주었을까요?",
      "오늘날 디지털 시대의 정보 격차는 과거 '총, 균, 쇠'의 격차와 어떻게 닮아있을까요?"
    ]
  },
  {
    id: "NLK-012",
    title: "질문하는 한국사: 조선 건국부터 일제강점기까지",
    author: "전국역사교사모임",
    publisher: "사계절",
    callNo: "911-전12ㅈ",
    targetGrade: "중학교 1~3학년",
    category: "역사",
    keywords: ["한국사", "조선", "역사", "질문", "세종대왕", "독립운동", "사회"],
    synopsis: "단순 암기용 역사책이 아닌, '세종대왕은 왜 훈민정음을 비밀리에 창제했을까?'와 같이 역사적 사건의 이면에 숨은 결정적 질문을 던지며 스스로 생각하게 돕는 역사서.",
    coreConcepts: ["사료 비판적 읽기", "역사적 행위자의 고뇌", "오늘날과의 현재적 대화"],
    questions: [
      "세종대왕이 사대부들의 반대를 무릅쓰고 한글을 만들게 한 가장 큰 원동력은 무엇이었을까요?",
      "역사의 결정적 순간에 나라면 어떤 선택을 내렸을지 인물의 입장이 되어 상상해본 적이 있나요?",
      "역사를 배운다는 것은 과거의 사실을 외우는 것일까요, 미래를 살아갈 지혜를 얻는 것일까요?"
    ]
  },
  // 문학 / 청소년 성장
  {
    id: "NLK-013",
    title: "페인트 (Paint)",
    author: "이희영",
    publisher: "창비",
    callNo: "813.7-이94ㅍ",
    targetGrade: "중학교 1~3학년",
    category: "문학/청소년소설",
    keywords: ["소설", "성장", "가족", "부모", "미래", "선택", "청소년문학"],
    synopsis: "국가가 아이들을 키우고 청소년이 직접 부모를 면접 보고 선택하는 미래 사회 센터를 배경으로, 진정한 가족과 사랑의 의미를 묻는 제12회 창비청소년문학상 수상작.",
    coreConcepts: ["부모와 자녀의 건강한 관계", "선택과 책임", "가족의 본질"],
    questions: [
      "내가 부모를 직접 선택할 수 있다면, 어떤 가치관을 가진 부모를 고르고 싶나요?",
      "주인공 제누 301이 완벽한 조건의 부모 후보 대신 자신만의 선택을 내린 이유는 무엇일까요?",
      "부모와 자녀 사이에서 가장 필요한 사랑의 방식은 무엇이라고 생각하나요?"
    ]
  },
  // 환경 / 생태
  {
    id: "NLK-014",
    title: "청소년을 위한 침묵의 봄",
    author: "레이첼 카슨 원작",
    publisher: "에코리브르",
    callNo: "539.9-카54ㅊ",
    targetGrade: "중학교 1~3학년",
    category: "과학/생태환경",
    keywords: ["환경", "생태", "지구", "오염", "자연", "과학", "기후"],
    synopsis: "새들이 노래하지 않는 침묵의 봄이 온다면? 무분별한 화학 살충제 살포가 생태계를 어떻게 파괴하는지 폭로하여 현대 환경 운동의 불씨를 지핀 고전.",
    coreConcepts: ["먹이사슬과 생물농축", "생태계의 상호의존성", "지속가능한 지구"],
    questions: [
      "인간의 편리를 위해 자연을 통제하려는 시도가 왜 결국 인간에게 부메랑으로 돌아올까요?",
      "침묵의 봄 출간 이후 전 세계에서 DDT 살충제 사용이 금지된 과정에서 과학자의 사회적 책임은 무엇이었을까요?",
      "오늘날 기후 위기 시대에 우리가 실천할 수 있는 '작은 침묵의 봄 예방법'은 무엇일까요?"
    ]
  },
  // 철학 / 인문
  {
    id: "NLK-015",
    title: "10대를 위한 정의란 무엇인가",
    author: "마이클 샌델 원작",
    publisher: "와이즈베리",
    callNo: "190-샌24ㅈ",
    targetGrade: "중학교 2~3학년",
    category: "철학/윤리",
    keywords: ["철학", "정의", "도덕", "샌델", "공정", "사회", "선택"],
    synopsis: "브레이크가 고장 난 전차, 누구를 구할 것인가? 청소년들이 학교와 일상에서 마주하는 흥미진진한 딜레마를 통해 공리주의와 자유주의, 공동체주의 정의관을 탐구하는 철학 입문서.",
    coreConcepts: ["공리주의와 최대다수의 행복", "개인의 자유와 권리", "공동선과 미덕"],
    questions: [
      "다수를 구하기 위해 소수를 희생시키는 것은 과연 도덕적으로 정당할까요?",
      "노력과 능력에 따른 보상이 정말 100% 공정할까요, 아니면 행운도 작용할까요?",
      "우리 학교나 교실에서 더 정의롭고 공정한 규칙을 만든다면 무엇을 바꾸고 싶나요?"
    ]
  }
];

/* -------------------------------------------------------------
   3. Tool Engine (4 Tools specified in Jlab.md)
   ------------------------------------------------------------- */
const AgentTools = {
  // 1. askUser Tool
  askUser: function(params) {
    return {
      status: "SUCCESS",
      action: "askUser",
      question: params.question,
      hint: params.hint || "사용자와 깊이 있는 대화를 이어갑니다."
    };
  },

  // 3. makeStudyMarkdown Tool
  makeStudyMarkdown: function(params) {
    const selected = AgentState.recommendedBooks.find(b => b.id && b.id === params.bookId) || AgentState.recommendedBooks.at(-1);
    if (!selected) return { status: 'FAIL', message: '먼저 책을 선택해 주세요.' };
    const book = { ...selected, synopsis: selected.description || selected.synopsis || '확인된 책 소개가 없습니다.',
      coreConcepts: selected.coreConcepts || [], questions: selected.questions || [],
      callNo: selected.callNo || '확인되지 않음', targetGrade: selected.targetGrade || '확인되지 않음' };

    const dateStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const markdown = `
# 📖 국립중앙도서관 청소년 심화 독서 탐구 노트
**문서등록번호**: NLK-STUDY-${new Date().getFullYear()}-${book.id}  
**작성일자**: ${dateStr}  
**대상자**: ${AgentState.userGrade} 학생  

---

## 1. 도서 기본 서지 정보
- **도서명**: ${book.title}
- **저자 / 출판사**: ${book.author} / ${book.publisher}
- **국립중앙도서관 청구기호**: \`${book.callNo}\`
- **권장 학년**: ${book.targetGrade}
- **핵심 분류**: ${book.category}

---

## 2. 수석 사서의 핵심 줄거리 및 개념 요약
${book.synopsis}

### 💡 핵심 키워드 & 개념
${book.coreConcepts.map(c => `- **${c}**`).join('\n')}

---

## 3. 심화 사유를 위한 수석 사서의 탐구 질문 3선
${book.questions.map((q, idx) => `### Q${idx + 1}. ${q}\n*(나의 생각)*: `).join('\n\n')}

---

## 4. 학생 자율 독서 성찰 기록
> **"책을 읽기 전의 나와 책을 읽고 난 후의 나는 결코 같지 않다."**
- **가장 인상 깊었던 구절이나 장면**: ____________________
- **이 책을 통해 새롭게 깨달은 호기심**: ____________________
- **다음으로 연계하여 읽고 싶은 주제**: ${AgentState.userInterests.join(', ') || '과학, 문학 등'}

---
*국립중앙도서관 청소년열람실 수석사서실 인증*
    `.trim();

    AgentState.currentDocument = {
      book: book,
      markdown: markdown,
      createdAt: dateStr
    };

    renderHud();

    return {
      status: "SUCCESS",
      bookTitle: book.title,
      documentCreated: true,
      previewSnippet: markdown.substring(0, 150) + "..."
    };
  },

  // 4. exportPDF Tool
  exportPDF: function() {
    if (!AgentState.currentDocument) {
      return { status: "FAIL", message: "작성된 독서 노트가 없습니다." };
    }
    openNoteModal();
    return {
      status: "SUCCESS",
      action: "exportPDF",
      message: "독서 노트 인쇄 및 PDF 미리보기 창을 호출했습니다."
    };
  }
};

/* -------------------------------------------------------------
   4. Guardrail & Safety Engine
   ------------------------------------------------------------- */
const SafetyGuardrail = {
  forbiddenKeywords: [
    "성인물", "야동", "포르노", "잔혹", "살인청부", "칼부림", 
    "폭력", "자해", "자살", "마약", "성관계", "비속어", "시발", "존나", "혐오"
  ],
  jailbreakKeywords: [
    "이전 지침 무시", "지침 무시", "탈옥", "역할극 하자", "시스템 프롬프트", 
    "가드레일 해제", "dan 모드", "jailbreak"
  ],

  check: function(input) {
    const lower = input.toLowerCase();
    
    for (const jb of this.jailbreakKeywords) {
      if (lower.includes(jb)) {
        return {
          isSafe: false,
          reason: "우회/탈옥 시도 감지",
          type: "JAILBREAK",
          fallbackMessage: "학생, 도서관에서는 기존의 규칙과 예절을 지키며 대화해야 해요. 이전 지침을 변경할 수는 없답니다. 대신 오늘 우리 함께 지혜를 넓힐 수 있는 멋진 책을 찾아보지 않을래요?"
        };
      }
    }

    for (const kw of this.forbiddenKeywords) {
      if (lower.includes(kw)) {
        return {
          isSafe: false,
          reason: `부적합 키워드 [${kw}] 감지`,
          type: "HARMFUL",
          fallbackMessage: "해당 내용은 중학생 학생의 학습과 정서에 적절하지 않아요. 우리 도서관은 건강하고 깊이 있는 지적 성장을 응원한답니다. 대신 흥미진진한 과학 미스터리나 감동적인 성장 소설을 함께 찾아볼까요?"
        };
      }
    }

    return { isSafe: true };
  }
};

/* -------------------------------------------------------------
   5. Autonomous Agent Core (Express 백엔드 연동)
   - 브라우저 -> Express 서버(/api/recommend-books) -> .env -> Gemini
   - 프론트엔드에 API 키 일체 미포함
   ------------------------------------------------------------- */
const API_BASE_URL = window.location.origin.includes(':3002') 
  ? '' 
  : (window.location.origin.includes(':5173') ? 'http://localhost:3002' : '');

async function callRecommendBooksApi(userMessage) {
  const url = `${API_BASE_URL}/api/recommend-books`;

  const payload = {
    userMessage,
    userGrade: AgentState.userGrade,
    userInterests: AgentState.userInterests,
    recommendedBooks: AgentState.recommendedBooks,
    chatHistory: AgentState.chatHistory
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Server API HTTP Error: ${response.status}`);
  }

  return await response.json();
}

async function runAgentTurn(userMessage) {
  AgentState.turnCount++;
  const currentTurn = AgentState.turnCount;

  AgentState.chatHistory.push({ role: "user", content: userMessage });

  // 1. Guardrail Inspection First
  const safety = SafetyGuardrail.check(userMessage);
  
  if (!safety.isSafe) {
    renderTaoTurn({
      turn: currentTurn,
      thought: `[가드레일 감지] 사용자 입력에서 안전 규칙 위반 또는 탈옥 시도 확인 (${safety.reason}).\n규칙에 따라 기존 사서 페르소나 및 안전 가이드라인을 엄격히 유지하며 '좋은 반려(Fallback)' 원칙을 적용합니다.`,
      actionName: "guardrailFallback",
      actionParams: { reason: safety.reason, type: safety.type },
      observation: `유해 요청 차단 완료. 사용자에게 정중한 거절 사유 안내 및 건전한 독서 주제로의 전환 유도.`,
      isSafe: false
    });

    appendLibrarianMessage(safety.fallbackMessage);
    AgentState.chatHistory.push({ role: "librarian", content: safety.fallbackMessage });
    return;
  }

  // 2. Extract dynamic interest keywords to update Agent State
  extractInterests(userMessage);

  const isRequestingNote = /독서\s*노트|정리해|요약본|pdf|프린트|인쇄|마크다운|노트\s*작성/i.test(userMessage);
  const activeBook = AgentState.recommendedBooks.at(-1);
  if (isRequestingNote) {
    if (activeBook) {
      AgentTools.makeStudyMarkdown({ bookId: activeBook.id });
      appendLibrarianMessage('확인된 책 정보로 독서노트를 정리했어.', null, true);
    } else {
      appendLibrarianMessage('먼저 읽고 싶은 책을 찾아보자. 책을 고른 뒤 독서노트를 만들 수 있어.');
    }
    return;
  }

  // An empty result is a valid answer. Never replace it with an embedded/mock book.
  try {
    const result = await callRecommendBooksApi(userMessage);
    if (!result.success || !Array.isArray(result.books)) throw new Error('Invalid recommendation response');
    const books = result.books.filter(book => ['library', 'web'].includes(book.sourceType));
    const response = books.length ? result.response : '조건에 딱 맞는 책을 확인하지 못했어.\n관심 분야나 난이도를 조금 넓혀서 다시 찾아볼까?';
    for (const book of books) {
      if (!AgentState.recommendedBooks.some(existing =>
        (existing.isbn13 && book.isbn13 && existing.isbn13 === book.isbn13) ||
        (existing.title === book.title && existing.author === book.author))) {
        AgentState.recommendedBooks.push(book);
      }
    }
    renderHud();
    AgentState.chatHistory.push({ role: 'librarian', content: response });
    renderTaoTurn({ turn: currentTurn, thought: '요청과 실제 검색 근거 확인',
      actionName: result.search?.fallbackUsed ? 'searchWebBooks' : 'searchLibraryBooks',
      actionParams: { count: books.length }, observation: books.length ? '확인된 도서 표시' : '조건에 맞는 도서 미확인', isSafe: true });
    appendLibrarianMessage(response, books, false, result.searchSuggestionsHtml);
  } catch {
    const response = '지금은 책 정보를 확인할 수 없어. 잠시 후 다시 찾아볼까?';
    AgentState.chatHistory.push({ role: 'librarian', content: response });
    appendLibrarianMessage(response);
  }
}

/* -------------------------------------------------------------
   6. UI Rendering & Interactions
   ------------------------------------------------------------- */
function initApp() {
  try {
    const profile = JSON.parse(localStorage.getItem('reading-agent-profile') || '{}');
    if (profile.grade) {
      if (profile.grade === '중1') AgentState.userGrade = '중학교 1학년';
      else if (profile.grade === '중2') AgentState.userGrade = '중학교 2학년';
      else if (profile.grade === '중3') AgentState.userGrade = '중학교 3학년';
      else AgentState.userGrade = profile.grade;

      const gradeSelect = document.getElementById('gradeSelect');
      if (gradeSelect) gradeSelect.value = AgentState.userGrade;
    }
  } catch (e) {
    console.warn('프로필 로드 실패:', e);
  }

  document.getElementById('hudGrade').innerText = AgentState.userGrade;
  
  const initialGreeting = `좋아하는 주제나 이야기 하나만 들려줘. 너에게 어울리는 책을 함께 찾아볼게.`;
  
  appendLibrarianMessage(initialGreeting);

  renderTaoTurn({
    turn: 0,
    thought: `국립중앙도서관 독서 큐레이터 세션 초기화 완료.\n사용자 기본 프로필(${AgentState.userGrade}) 확인 및 친절하고 지적인 수석 사서 페르소나 가동. 가드레일 감시 모듈 ON. Express 백엔드 연동 완료.`,
    actionName: "askUser",
    actionParams: { question: "어떤 호기심을 찾아 도서관에 오셨나요?", grade: AgentState.userGrade },
    observation: `사용자의 첫 번째 발화 대기 중. 관심사 키워드 수집 준비 완료.`,
    isSafe: true
  });
}

function extractInterests(text) {
  const keywordsPool = [
    "우주", "천문학", "블랙홀", "과학", "물리", "화학",
    "소설", "문학", "추리", "미스터리", "모험", "판타지",
    "인공지능", "ai", "로봇", "코딩", "미래",
    "역사", "조선", "한국사", "철학", "사회"
  ];

  keywordsPool.forEach(kw => {
    if (text.toLowerCase().includes(kw) && !AgentState.userInterests.includes(kw)) {
      AgentState.userInterests.push(kw);
    }
  });

  renderHud();
}

function renderHud() {
  document.getElementById('hudGrade').innerText = AgentState.userGrade;

  const interestsContainer = document.getElementById('hudInterests');
  if (AgentState.userInterests.length === 0) {
    interestsContainer.innerHTML = `<span style="color: var(--text-muted); font-size: 0.78rem;">대화를 통해 탐색 중...</span>`;
  } else {
    interestsContainer.innerHTML = AgentState.userInterests.map(tag => `<span class="tag-badge">#${tag}</span>`).join('');
  }

  document.getElementById('hudBooksCount').innerHTML = `
    <span style="color: #fef08a; font-weight: bold;">${AgentState.recommendedBooks.length}권 추천됨</span>
  `;

  const docStatus = document.getElementById('hudDocStatus');
  const headerBtn = document.getElementById('headerNoteBtn');
  if (AgentState.currentDocument) {
    docStatus.innerHTML = `
      <span class="doc-preview-badge" onclick="openNoteModal()">
         작성 완료 [열람하기]
      </span>
    `;
    headerBtn.style.display = 'inline-flex';
  } else {
    docStatus.innerHTML = `<span style="color: var(--text-muted); font-size: 0.78rem;">미작성 (대기)</span>`;
    headerBtn.style.display = 'none';
  }
}

function renderTaoTurn(data) {
  const timeline = document.getElementById('taoTimeline');
  const card = document.createElement('div');
  card.className = 'tao-turn-card';

  const turnTitle = data.turn === 0 ? "Initial Session Start" : `Turn #${data.turn} 추론 사이클`;
  const guardTag = data.isSafe 
    ? `<span class="guardrail-tag"> 가드레일 통과</span>`
    : `<span class="guardrail-tag warn"> 가드레일 경고</span>`;

  card.innerHTML = `
    <div class="tao-turn-header">
      <span> ${turnTitle}</span>
      <div>${guardTag}</div>
    </div>
    <div class="tao-turn-body">
      <!-- T: Thought -->
      <div class="tao-step-block tao-thought-block">
        <div class="tao-step-label">
           T (Thought / 추론)
        </div>
        <div>${escapeHtml(data.thought).replace(/\n/g, '<br>')}</div>
      </div>

      <!-- A: Action -->
      <div class="tao-step-block tao-action-block">
        <div class="tao-step-label">
           A (Action / 도구 호출)
        </div>
        <div class="tao-code-pill">${escapeHtml(data.actionName)}(${JSON.stringify(data.actionParams, null, 2)})</div>
      </div>

      <!-- O: Observation -->
      <div class="tao-step-block tao-obs-block">
        <div class="tao-step-label">
           O (Observation / 관찰)
        </div>
        <div>${escapeHtml(data.observation).replace(/\n/g, '<br>')}</div>
      </div>
    </div>
  `;

  timeline.appendChild(card);
  timeline.scrollTop = timeline.scrollHeight;
}

function formatChatText(text) {
  if (!text) return "";
  let escaped = escapeHtml(text);
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
  escaped = escaped.replace(/`([^`]+)`/g, '<code style="background: var(--bg-subtle); padding: 2px 5px; border-radius: 4px; color: var(--text-primary); font-size: 0.85em;">$1</code>');
  escaped = escaped.replace(/\n/g, '<br>');
  return escaped;
}

function appendUserMessage(text) {
  const container = document.getElementById('chatMessages');
  const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg-group user';
  msgDiv.innerHTML = `
    <div style="display: flex; flex-direction: column;">
      <div class="msg-bubble">${formatChatText(text)}</div>
      <div class="msg-time">${timeStr}</div>
    </div>
  `;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function escapeJsString(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function readThisBook(title, author) {
  const fullTitle = author && author !== '저자 미상' ? `${title} (${author})` : title;

  // 1. ReadingState 세션에 제목 저장 (로컬스토리지 영속화)
  try {
    const sessionKey = 'reading-agent-current-session';
    const session = JSON.parse(localStorage.getItem(sessionKey) || '{}');
    session.bookTitle = fullTitle;
    localStorage.setItem(sessionKey, JSON.stringify(session));
  } catch (e) {
    console.error('세션 저장 실패:', e);
  }

  // 2. 기존 [책 읽기 도우미] 화면으로 이동 (?title=...)
  const targetUrl = '/?title=' + encodeURIComponent(fullTitle);
  window.location.href = targetUrl;
}

function appendLibrarianMessage(text, books = null, showNotePrompt = false, searchSuggestionsHtml = null) {
  const container = document.getElementById('chatMessages');
  const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg-group librarian';

  let bookCardsHtml = "";
  if (books && books.length > 0) {
    bookCardsHtml = `
      <div class="book-cards-container">
        ${books.slice(0, 3).map(book => {
          const coverHtml = book.cover 
            ? `<div class="book-cover-wrap">
                 <img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)} 표지" class="book-cover-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                 <div class="book-cover-fallback" style="display: none;"><span>표지 준비 중</span></div>
               </div>`
            : `<div class="book-cover-wrap">
                 <div class="book-cover-fallback"><span>표지 준비 중</span></div>
               </div>`;

          const authorText = book.author || book.authors || '저자 미상';
          const publisherText = book.publisher || '';
          const sourceUrl = safeBookSourceUrl(book.sourceUrl);
          const categoryText = book.category || book.classNm || '';
          const reasonText = book.reason || book.synopsis || '';

          return `
            <div class="book-card">
              ${coverHtml}
              <div class="book-card-content">
                <div class="book-card-header">
                  <div class="book-title">
                     ${escapeHtml(book.title)}
                  </div>
                  ${categoryText ? `<span class="book-badge">${escapeHtml(categoryText)}</span>` : ''}
                </div>
                <div class="book-meta">
                  <span> ${escapeHtml(authorText)}</span>
                  ${publisherText ? `<span>${escapeHtml(publisherText)}</span>` : ''}
                  ${book.sourceType === 'library' ? '<span class="book-source">도서관 소장 도서</span>' : book.sourceType === 'web' ? `<span class="book-source">웹에서 찾은 도서${sourceUrl ? ` · <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">출처 확인</a>` : ''}</span>` : ''}
                </div>
                ${reasonText ? `
                  <div class="book-reason">
                    
                    <span class="reason-text">${escapeHtml(reasonText)}</span>
                  </div>
                ` : ''}
                <div class="book-actions">
                  <button class="book-btn primary" onclick="readThisBook('${escapeHtml(escapeJsString(book.title))}', '${escapeHtml(escapeJsString(authorText))}')">
                     이 책 읽기
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  let noteQuickAction = "";
  if (showNotePrompt && AgentState.currentDocument) {
    noteQuickAction = `
      <div style="margin-top: 10px;">
        <button class="header-btn primary" onclick="openNoteModal()" style="font-size: 0.82rem; padding: 6px 14px;">
           독서노트 보기
        </button>
      </div>
    `;
  }

  msgDiv.innerHTML = `

    <div style="display: flex; flex-direction: column; max-width: 100%;">
      <div class="msg-bubble">${formatChatText(text)}</div>
      ${bookCardsHtml}
      ${noteQuickAction}
      <div class="msg-time">
        <span>${timeStr}</span>
      </div>
    </div>
  `;

  if (searchSuggestionsHtml && books?.some(book => book.sourceType === 'web')) {
    const suggestions = document.createElement('iframe');
    suggestions.className = 'search-suggestions';
    suggestions.title = 'Google 검색 제안';
    // Render provider attribution isolated from the application and its localStorage.
    suggestions.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
    suggestions.srcdoc = searchSuggestionsHtml;
    msgDiv.appendChild(suggestions);
  }
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function safeBookSourceUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

function handleSendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  appendUserMessage(text);
  input.value = "";
  input.style.height = "auto";

  setTimeout(() => {
    runAgentTurn(text);
  }, 400);
}

function handleInputKeydown(e) {
  if (e.isComposing) return;
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}

function sendQuickPrompt(promptText) {
  document.getElementById('chatInput').value = promptText;
  handleSendMessage();
}

function requestNoteForBook(bookId) {
  appendUserMessage(`이 책으로 독서 노트 작성해줘.`);
  setTimeout(() => {
    const toolRes = AgentTools.makeStudyMarkdown({ bookId: bookId });
    
    AgentState.turnCount++;
    renderTaoTurn({
      turn: AgentState.turnCount,
      thought: `사용자가 특정 도서(ID: ${bookId})에 대한 맞춤형 독서 노트를 명시적으로 요청함.\n'makeStudyMarkdown' 도구로 핵심 요약과 청소년 사유 질문 3선을 생성함.`,
      actionName: "makeStudyMarkdown",
      actionParams: { bookId: bookId },
      observation: `독서 노트 작성 완료. 서지 등록 번호 발급됨.`,
      isSafe: true
    });

    appendLibrarianMessage(
      `요청하신 도서 **《${toolRes.bookTitle}》**에 대해 핵심 요약과 사유 질문 3선이 포함된 독서 노트를 완성했어요!\n지금 바로 열람하시거나 PDF로 인쇄해 보세요.`,
      null,
      true
    );
  }, 400);
}

function handleGradeChange(newGrade) {
  AgentState.userGrade = newGrade;
  renderHud();

  try {
    let simpleGrade = '중1';
    if (newGrade.includes('2')) simpleGrade = '중2';
    else if (newGrade.includes('3')) simpleGrade = '중3';
    localStorage.setItem('reading-agent-profile', JSON.stringify({ grade: simpleGrade }));
  } catch (e) {
    console.warn('프로필 저장 실패:', e);
  }
  
  AgentState.turnCount++;
  renderTaoTurn({
    turn: AgentState.turnCount,
    thought: `사용자 학년이 [${newGrade}]로 갱신됨. 이후 도서 큐레이션 및 추천 난이도 기준을 해당 학년 수준에 맞추어 조정함.`,
    actionName: "updateGradeState",
    actionParams: { newGrade: newGrade },
    observation: `AgentState.userGrade 동기화 완료: ${newGrade}`,
    isSafe: true
  });

  appendLibrarianMessage(`대상 학년을 **${newGrade}**으로 변경하여 기억해두었어요. 앞으로 이 수준에 딱 맞는 유익한 도서를 권해드릴게요!`);
}

/* -------------------------------------------------------------
   7. Note Modal & PDF Print Functions
   ------------------------------------------------------------- */
function openNoteModal() {
  if (!AgentState.currentDocument) {
    const book = AgentState.recommendedBooks.at(-1);
    if (!book) return;
    AgentTools.makeStudyMarkdown({ bookId: book.id });
  }

  const doc = AgentState.currentDocument;
  const b = doc.book;
  const modalBody = document.getElementById('noteModalBody');

  modalBody.innerHTML = `
    <div class="note-sheet" id="printableNote">
      <div class="note-official-seal">국립중앙도서관<br>사서인증</div>
      <h1>청소년 심화 독서 탐구 노트</h1>
      
      <table class="note-meta-table">
        <tr>
          <td class="th">도서명</td>
          <td><strong>${escapeHtml(b.title)}</strong></td>
          <td class="th">청구기호</td>
          <td><code>${escapeHtml(b.callNo)}</code></td>
        </tr>
        <tr>
          <td class="th">저자/출판사</td>
          <td>${escapeHtml(b.author)} / ${escapeHtml(b.publisher)}</td>
          <td class="th">작성일자</td>
          <td>${doc.createdAt}</td>
        </tr>
        <tr>
          <td class="th">작성자</td>
          <td>${AgentState.userGrade} 학생</td>
          <td class="th">담당 사서</td>
          <td>수석 사서 정서원</td>
        </tr>
      </table>

      <div class="note-section-title">
         1. 핵심 내용 및 줄거리 요약
      </div>
      <div class="note-content-box">
        ${escapeHtml(b.synopsis)}
      </div>

      <div class="note-section-title">
         2. 핵심 사유 개념
      </div>
      <div class="note-content-box">
        ${b.coreConcepts.map(c => `• <strong>${escapeHtml(c)}</strong>`).join(' &nbsp;|&nbsp; ')}
      </div>

      <div class="note-section-title">
         3. 사서 선생님의 생각할 거리 (탐구 질문 3선)
      </div>
      <div class="note-content-box">
        ${b.questions.map((q, idx) => `
          <div class="note-question-item">
            <strong>질문 ${idx + 1}:</strong> ${escapeHtml(q)}
          </div>
        `).join('')}
      </div>

      <div class="note-section-title">
         4. 학생 자율 독서 감상 및 느낀 점
      </div>
      <div class="student-write-area">
        여기에 책을 읽은 후 나의 생각과 느낀 점을 자유롭게 적어보세요.
      </div>
    </div>
  `;

  document.getElementById('noteModal').classList.add('active');
}

function closeNoteModal() {
  document.getElementById('noteModal').classList.remove('active');
}

function printStudyNote() {
  window.print();
}

function copyMarkdownContent() {
  if (!AgentState.currentDocument) return;
  navigator.clipboard.writeText(AgentState.currentDocument.markdown).then(() => {
    alert("독서 노트 마크다운이 클립보드에 복사되었습니다!");
  });
}

function downloadMarkdownFile() {
  if (!AgentState.currentDocument) return;
  const blob = new Blob([AgentState.currentDocument.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `독서노트_${AgentState.currentDocument.book.title.replace(/\s+/g, '_')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------
   8. Settings Modal (API Key 입력 완전 제거 / 보안 강화)
   ------------------------------------------------------------- */
function openSettingsModal() {
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

function resetSession() {
  if (confirm("대화 내용과 탐색된 독서 기록을 초기화하시겠습니까?")) {
    AgentState.turnCount = 0;
    AgentState.userGrade = "중학교 1학년";
    AgentState.userInterests = [];
    AgentState.recommendedBooks = [];
    AgentState.currentDocument = null;
    AgentState.chatHistory = [];
    const gradeSelect = document.getElementById('gradeSelect');
    if (gradeSelect) gradeSelect.value = "중학교 1학년";
    document.getElementById('chatMessages').innerHTML = "";
    document.getElementById('taoTimeline').innerHTML = "";
    initApp();
  }
}

function clearTaoFeed() {
  document.getElementById('taoTimeline').innerHTML = "";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.getElementById('header-container').innerHTML = serviceHeader('recommend',
  `<select id="gradeSelect" class="grade-control" aria-label="학년 변경" onchange="handleGradeChange(this.value)">
    <option value="중학교 1학년">중1</option><option value="중학교 2학년">중2</option><option value="중학교 3학년">중3</option>
  </select>`, '<button class="btn-secondary-sm" onclick="resetSession()">새 세션</button>');

// Preserve existing HTML event bindings when bundled as an ES module.
Object.assign(window, { handleGradeChange, resetSession, sendQuickPrompt, handleInputKeydown,
  handleSendMessage, readThisBook, requestNoteForBook, openNoteModal, closeNoteModal,
  copyMarkdownContent, downloadMarkdownFile, printStudyNote });

// Auto-resize textarea
const chatInput = document.getElementById('chatInput');
if (chatInput) {
  chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
}

// Close modals on clicking overlay
window.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// Start App
window.addEventListener('DOMContentLoaded', initApp);
