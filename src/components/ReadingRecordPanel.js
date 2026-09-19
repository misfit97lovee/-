let currentRecordTab = 'summary';

export function renderReadingRecordPanel(container, {
  state,
  onGenerateSummary,
  isSummaryLoading,
  onGenerateReadingNote,
  isReadingNoteLoading
}) {
  let activeTab = currentRecordTab;

  function update() {
    container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title">
          <span>📝</span>
          <span>독서 기록</span>
        </div>
      </div>

      <div class="panel-body">
        <div class="record-tabs">
          <button class="record-tab-btn ${activeTab === 'summary' ? 'active' : ''}" data-tab="summary">
            오늘의 요약
          </button>
          <button class="record-tab-btn ${activeTab === 'reading-note' ? 'active' : ''}" data-tab="reading-note">
            오늘의 독서노트
          </button>
          <button class="record-tab-btn ${activeTab === 'tao' ? 'active' : ''}" data-tab="tao">
            AI 작업 로그(TAO)
          </button>
        </div>

        ${activeTab === 'summary' ? renderSummaryTab(state.session.summary, isSummaryLoading) : ''}
        ${activeTab === 'reading-note' ? renderReadingNoteTab(state.session.readingNote, isReadingNoteLoading) : ''}
        ${activeTab === 'tao' ? renderTaoList(state.taoLogs) : ''}
      </div>
    `;

    // 탭 전환 이벤트
    container.querySelectorAll('.record-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentRecordTab = btn.getAttribute('data-tab');
        activeTab = currentRecordTab;
        update();
      });
    });

    // 요약 버튼 이벤트
    const summaryBtn = container.querySelector('#btn-generate-summary');
    if (summaryBtn) {
      summaryBtn.addEventListener('click', () => {
        if (!isSummaryLoading && onGenerateSummary) {
          onGenerateSummary();
        }
      });
    }

    // 독서노트 업데이트 버튼 이벤트
    const noteBtn = container.querySelector('#btn-update-reading-note');
    if (noteBtn) {
      noteBtn.addEventListener('click', () => {
        if (!isReadingNoteLoading && onGenerateReadingNote) {
          onGenerateReadingNote();
        }
      });
    }
  }

  update();
}

function renderSummaryTab(summary, isSummaryLoading) {
  return `
    <div style="display: flex; flex-direction: column; gap: 14px; flex: 1;">
      <button
        id="btn-generate-summary"
        class="btn-send-book"
        ${isSummaryLoading ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}
        style="background: #059669;"
      >
        ${isSummaryLoading ? '⏳ 대화 내용 분석 및 요약 중...' : '✨ 지금까지 읽은 내용 요약하기'}
      </button>

      ${isSummaryLoading ? `
        <div class="phase-placeholder" style="margin-top: 10px;">
          <div style="font-size: 28px;">📖</div>
          <div style="font-weight: 600; color: var(--text-primary); margin-top: 4px;">대화에서 확인된 내용을 정리하고 있어요</div>
          <p style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">
            확인되지 않은 뒷이야기는 지어내지 않고, 실제 나눈 대화만 요약합니다.
          </p>
        </div>
      ` : summary ? `
        <div class="summary-result-card" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); line-height: 1.7; font-size: 13.5px; white-space: pre-wrap; color: var(--text-primary);">
${escapeHtml(summary)}
        </div>
        <div style="font-size: 11px; color: var(--text-muted); text-align: right;">
          ※ 새로고침 후에도 이 요약 내용은 브라우저에 보존됩니다.
        </div>
      ` : `
        <div class="phase-placeholder" style="margin-top: 10px;">
          <div style="font-size: 28px;">📖</div>
          <div style="font-weight: 600; color: var(--text-primary);">아직 요약이 생성되지 않았습니다</div>
          <p style="color: var(--text-secondary); font-size: 12px; margin-top: 4px;">
            AI와 책에 대해 대화를 나눈 뒤 위 [지금까지 읽은 내용 요약하기] 버튼을 누르면 핵심 내용이 깔끔하게 정리됩니다.
          </p>
        </div>
      `}
    </div>
  `;
}

function renderReadingNoteTab(note, isReadingNoteLoading) {
  return `
    <div style="display: flex; flex-direction: column; gap: 14px; flex: 1;">
      <button
        id="btn-update-reading-note"
        class="btn-send-book"
        ${isReadingNoteLoading ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}
        style="background: var(--primary);"
      >
        ${isReadingNoteLoading ? '⏳ 대화 분석 및 독서노트 작성 중...' : '📝 독서노트 업데이트'}
      </button>

      ${isReadingNoteLoading ? `
        <div class="phase-placeholder" style="margin-top: 10px;">
          <div style="font-size: 28px;">✍️</div>
          <div style="font-weight: 600; color: var(--text-primary); margin-top: 4px;">오늘의 독서노트를 정리하고 있어요</div>
          <p style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">
            사용자가 말하지 않은 생각은 지어내지 않고, 실제 대화와 이해도 체크 결과만 기록합니다.
          </p>
        </div>
      ` : note ? `
        ${renderFormattedReadingNote(note)}
        <div style="font-size: 11px; color: var(--text-muted); text-align: right;">
          ※ 새로고침 후에도 이 독서노트는 브라우저에 보존됩니다.
        </div>
      ` : `
        <div class="phase-placeholder" style="margin-top: 10px;">
          <div style="font-size: 28px;">✍️</div>
          <div style="font-weight: 600; color: var(--text-primary);">아직 작성된 독서노트가 없습니다</div>
          <p style="color: var(--text-secondary); font-size: 12px; margin-top: 4px;">
            책 사진을 올리고 대화를 나눈 뒤 위 [독서노트 업데이트] 버튼을 누르면 읽은 내용, 어려웠던 점, 새롭게 이해한 것, 나의 생각, 이해도 결과가 자동으로 정리됩니다.
          </p>
        </div>
      `}
    </div>
  `;
}

function renderFormattedReadingNote(note) {
  if (!note) return '';

  const lines = note.split('\n');
  let title = '📖 오늘의 독서노트';
  const sections = [];
  let currentSec = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('📖')) {
      title = trimmed;
    } else if (trimmed.startsWith('### ')) {
      if (currentSec) sections.push(currentSec);
      currentSec = {
        title: trimmed.replace(/^###\s*/, ''),
        content: []
      };
    } else if (currentSec) {
      if (trimmed) currentSec.content.push(trimmed);
    }
  }
  if (currentSec) sections.push(currentSec);

  if (sections.length === 0) {
    return `
      <div class="summary-result-card" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); line-height: 1.7; font-size: 13.5px; white-space: pre-wrap; color: var(--text-primary);">
${escapeHtml(note)}
      </div>
    `;
  }

  const iconMap = {
    '읽은 내용': '📑',
    '어려웠던 부분': '⚠️',
    '새롭게 이해한 것': '💡',
    '내가 한 생각': '💭',
    '이해도 확인 결과': '🎯',
    '다음에 기억할 것': '📌'
  };

  return `
    <div class="reading-note-card" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 12px;">
      <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); border-bottom: 2px solid var(--primary); padding-bottom: 8px;">
        ${escapeHtml(title)}
      </div>
      ${sections.map(sec => {
        const icon = iconMap[sec.title] || '📌';
        const bodyText = sec.content.join('\n');
        const isNotDiscussed = bodyText.includes('아직 이야기하지 않았어요') || bodyText.includes('현재 대화에서는 확인되지 않았어요');
        return `
          <div class="note-section-block" style="background: var(--bg-subtle); border-radius: var(--radius-sm); padding: 10px 12px; border: 1px solid rgba(0,0,0,0.05);">
            <div style="font-weight: 600; font-size: 12.5px; color: var(--primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <span>${icon}</span>
              <span>${escapeHtml(sec.title)}</span>
            </div>
            <div style="font-size: 13px; color: ${isNotDiscussed ? 'var(--text-muted)' : 'var(--text-primary)'}; line-height: 1.6; white-space: pre-wrap;">
${escapeHtml(bodyText || '아직 이야기하지 않았어요')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTaoList(logs) {
  if (!logs || logs.length === 0) {
    return `
      <div class="phase-placeholder" style="margin-top: 20px;">
        <div style="font-size: 28px;">⚙️</div>
        <div style="font-weight: 600; color: var(--text-primary);">AI 작업 기록이 비어있습니다</div>
        <p style="color: var(--text-secondary); font-size: 12px; margin-top: 4px;">
          질문을 주고받으면 AI의 판단 요약(T), 실행한 기능(A), 결과(O)가 여기에 기록됩니다.
        </p>
      </div>
    `;
  }

  return `
    <div class="tao-list">
      <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">
        최근 AI의 판단 및 실행 과정 (최근 10건)
      </div>
      ${logs.map(log => `
        <div class="tao-card">
          <div class="tao-row">
            <span class="tao-tag tag-t">T 판단</span>
            <span class="tao-desc">${escapeHtml(log.thoughtSummary)}</span>
          </div>
          <div class="tao-row">
            <span class="tao-tag tag-a">A 기능</span>
            <span class="tao-desc">${escapeHtml(log.action)}</span>
          </div>
          <div class="tao-row">
            <span class="tao-tag tag-o">O 결과</span>
            <span class="tao-desc">${escapeHtml(log.observation)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
