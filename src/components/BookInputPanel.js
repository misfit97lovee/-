export function renderBookInputPanel(container, { onSendToChat, onSendImage }) {
  let activeTab = 'image'; // 우선순위 1이므로 기본 탭을 '책 사진 올리기'로 설정
  let selectedFile = null;
  let previewUrl = null;

  function update() {
    container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title">
          <span>책 내용</span>
        </div>
      </div>

      <div class="panel-body">
        <div class="book-tabs">
          <button class="book-tab-btn ${activeTab === 'image' ? 'active' : ''}" data-tab="image">
            사진
          </button>
          <button class="book-tab-btn ${activeTab === 'direct' ? 'active' : ''}" data-tab="direct">
            직접 입력
          </button>
        </div>

        ${activeTab === 'image' ? renderImageTab(selectedFile, previewUrl) : ''}
        ${activeTab === 'direct' ? renderTextTab(activeTab) : ''}
      </div>
    `;

    // 탭 전환 이벤트
    container.querySelectorAll('.book-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        update();
      });
    });

    // 텍스트 전송 이벤트 바인딩
    const submitTextBtn = container.querySelector('#btn-submit-book-text');
    if (submitTextBtn) {
      submitTextBtn.addEventListener('click', () => {
        const textarea = container.querySelector('#book-text-input');
        const text = textarea.value.trim();
        if (!text) {
          alert('책 내용을 입력해 주세요.');
          return;
        }
        onSendToChat(`[책 내용] "${text}"\n이 부분이 잘 이해가 안 돼.`);
        textarea.value = '';
      });
    }

    // 파일 업로드 이벤트 바인딩
    const fileInput = container.querySelector('#book-photo-input');
    const dropZone = container.querySelector('#photo-dropzone');
    const removeBtn = container.querySelector('#btn-remove-photo');
    const submitImageBtn = container.querySelector('#btn-submit-book-photo');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        handleFileSelect(file);
      });
    }

    if (dropZone) {
      dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput?.click(); }
      });
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary)';
        dropZone.style.background = 'var(--primary-light)';
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.background = 'var(--bg-subtle)';
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.background = 'var(--bg-subtle)';
        const file = e.dataTransfer.files?.[0];
        handleFileSelect(file);
      });

      dropZone.addEventListener('click', () => {
        fileInput?.click();
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFile = null;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        update();
      });
    }

    if (submitImageBtn) {
      submitImageBtn.addEventListener('click', async () => {
        if (!selectedFile) {
          alert('먼저 책 사진을 업로드해 주세요.');
          return;
        }
        const commentInput = container.querySelector('#photo-comment-input');
        const comment = commentInput?.value.trim() || '책 페이지 사진을 찍었어. 이해하기 어려운 부분이 있어.';

        // Base64 변환
        const base64Data = await fileToBase64(selectedFile);
        const mimeType = selectedFile.type || 'image/jpeg';

        onSendImage({
          text: `[책 사진 업로드]\n${comment}`,
          image: {
            data: base64Data,
            mimeType: mimeType
          },
          previewUrl: previewUrl
        });

        // 전송 후 입력 폼 초기화
        selectedFile = null;
        previewUrl = null;
        update();
      });
    }
  }

  function handleFileSelect(file) {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert('jpg, jpeg, png 형식의 이미지만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('사진 용량이 너무 큽니다. 10MB 이하의 이미지를 올려주세요.');
      return;
    }
    selectedFile = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    update();
  }

  update();
}

function renderImageTab(selectedFile, previewUrl) {
  return `
    <div style="display: flex; flex-direction: column; gap: 14px; flex: 1;">
      <input
        type="file"
        id="book-photo-input"
        accept="image/jpeg, image/jpg, image/png"
        style="display: none;"
      />

      ${previewUrl ? `
        <div style="position: relative; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-subtle); text-align: center;">
          <img
            src="${previewUrl}"
            alt="책 사진 미리보기"
            style="max-height: 220px; max-width: 100%; object-fit: contain; display: inline-block;"
          />
          <button
            id="btn-remove-photo"
            style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: #fff; border: none; border-radius: var(--radius-full); width: 28px; height: 28px; cursor: pointer; font-size: 14px;"
            title="사진 제거"
          >✕</button>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary);">
          선택된 파일: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)
        </div>
      ` : `
        <div
          id="photo-dropzone"
          class="phase-placeholder photo-dropzone"
          role="button" tabindex="0" aria-label="책 페이지 사진 올리기"
        >
          <div style="font-weight: 500; color: var(--text-primary); margin-top: 4px;">책 페이지를 올려주세요</div>
          <p style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">
            JPG, PNG
          </p>
        </div>
      `}

      <input
        type="text"
        id="photo-comment-input"
        aria-label="사진에 대해 궁금한 점 (선택)"
        class="book-title-input"
        style="width: 100%;"
        placeholder="궁금한 점이 있다면 적어주세요"
      />

      <button
        id="btn-submit-book-photo"
        class="btn-send-book"
        ${!selectedFile ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
      >
        이 부분 물어보기
      </button>
    </div>
  `;
}

function renderTextTab(activeTab) {
  return `
    <textarea
      id="book-text-input"
      class="book-input-textarea"
      aria-label="책 내용 직접 입력" placeholder="어려운 문장이나 표현을 입력하거나 붙여넣어 주세요."
    ></textarea>

    <button id="btn-submit-book-text" class="btn-send-book">
      이 부분 물어보기
    </button>
  `;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // data:image/jpeg;base64,.... 에서 실제 base64 부분만 추출
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
