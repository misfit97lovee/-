export function renderHeader(container, state, { onOpenGradeModal, onResetSession, onTitleChange }) {
  const gradeText = state.student.grade ? `${state.student.grade}` : '학년 선택';

  container.innerHTML = `
    <div class="app-header">
      <div class="header-left">
        <div class="app-logo">
          <span>📖</span>
          <span>AI 독서 파트너</span>
          <span class="logo-badge">기본형</span>
        </div>
      </div>

      <div class="header-center">
        <input
          type="text"
          id="header-book-title"
          class="book-title-input"
          placeholder="읽고 있는 책 제목 입력..."
          value="${state.book.title || ''}"
        />
      </div>

      <div class="header-right">
        <button id="btn-grade-toggle" class="grade-badge-btn" title="학년 변경">
          <span>🎓</span>
          <span>${gradeText}</span>
          <span style="font-size: 10px; opacity: 0.7;">▾</span>
        </button>
        <button id="btn-reset-session" class="btn-secondary-sm" title="새 독서 세션 시작">
          새 세션
        </button>
      </div>
    </div>
  `;

  // 이벤트 바인딩
  const titleInput = container.querySelector('#header-book-title');
  titleInput.addEventListener('change', (e) => {
    onTitleChange(e.target.value.trim());
  });

  const gradeBtn = container.querySelector('#btn-grade-toggle');
  gradeBtn.addEventListener('click', () => {
    onOpenGradeModal();
  });

  const resetBtn = container.querySelector('#btn-reset-session');
  resetBtn.addEventListener('click', () => {
    if (confirm('현재 대화와 독서 세션을 초기화하고 새로 시작할까요?')) {
      onResetSession();
    }
  });
}
