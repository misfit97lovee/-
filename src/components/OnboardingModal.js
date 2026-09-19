export function renderOnboardingModal(container, { currentGrade, onSelectGrade, onClose }) {
  const grades = [
    { value: '중1', title: '중학교 1학년', desc: '기초 어휘와 흥미 중심의 쉬운 대화' },
    { value: '중2', title: '중학교 2학년', desc: '문맥과 인물 심리를 탐색하는 대화' },
    { value: '중3', title: '중학교 3학년', desc: '상징과 주제 의식을 연결하는 깊이 있는 대화' }
  ];

  container.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-content">
        <div style="font-size: 36px; margin-bottom: 8px;">🎓</div>
        <h2 class="modal-title">몇 학년이야?</h2>
        <p class="modal-subtitle">학년에 맞춰 설명 난이도와 어휘를 알맞게 조절해 줄게.</p>

        <div class="grade-options">
          ${grades.map(g => `
            <button class="grade-card-btn ${currentGrade === g.value ? 'selected' : ''}" data-grade="${g.value}">
              <div style="text-align: left;">
                <div style="font-weight: 700; color: var(--text-primary);">${g.title}</div>
                <div style="font-size: 12px; color: var(--text-secondary); font-weight: normal; margin-top: 2px;">${g.desc}</div>
              </div>
              <div style="font-size: 18px; color: var(--primary);">➔</div>
            </button>
          `).join('')}
        </div>

        ${currentGrade ? `
          <button id="btn-close-modal" class="btn-secondary-sm" style="width: 100%;">
            닫기
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // 카드 클릭 이벤트
  container.querySelectorAll('.grade-card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const grade = btn.getAttribute('data-grade');
      onSelectGrade(grade);
    });
  });

  const closeBtn = container.querySelector('#btn-close-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', onClose);
  }

  // 바깥 클릭 시 닫기 (이미 학년이 있는 경우만)
  const backdrop = container.querySelector('#modal-backdrop');
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && currentGrade) {
      onClose();
    }
  });
}
