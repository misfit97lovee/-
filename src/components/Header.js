export function serviceHeader(activePage, gradeControl, resetControl) {
  return `
    <div class="app-header">
      <a class="app-logo" href="/curator/index.html" aria-label="책읽기 홈">책읽기</a>
      <nav class="service-nav" aria-label="주 메뉴">
        <a href="/curator/index.html" ${activePage === 'recommend' ? 'aria-current="page"' : ''}>책 추천</a>
        <a href="/" ${activePage === 'reading' ? 'aria-current="page"' : ''}>읽기 도우미</a>
      </nav>
      <div class="header-right">${gradeControl}${resetControl}</div>
    </div>`;
}

export function renderHeader(container, state, { onOpenGradeModal, onResetSession, onTitleChange }) {
  const gradeText = state.student.grade || '학년 선택';
  container.innerHTML = serviceHeader('reading',
    `<button id="btn-grade-toggle" class="grade-control" aria-label="학년 변경">${gradeText}<span aria-hidden="true">⌄</span></button>`,
    '<button id="btn-reset-session" class="btn-secondary-sm">새 세션</button>') + `
    <div class="reading-heading">
      <div><h1>읽기 도우미</h1><p>어려운 문장부터, 함께 천천히 읽어요.</p></div>
      <label class="current-book">읽고 있는 책
        <input type="text" id="header-book-title" class="book-title-input" placeholder="책 제목을 입력해주세요" />
      </label>
    </div>`;

  const titleInput = container.querySelector('#header-book-title');
  titleInput.value = state.book.title || '';
  titleInput.addEventListener('change', (e) => onTitleChange(e.target.value.trim()));
  container.querySelector('#btn-grade-toggle').addEventListener('click', onOpenGradeModal);
  container.querySelector('#btn-reset-session').addEventListener('click', () => {
    if (confirm('현재 대화와 독서 세션을 초기화하고 새로 시작할까요?')) onResetSession();
  });
}
