/**
 * FormForge - Google Form Schema Parser
 * Extracts form metadata, entry IDs, question items, options, and tokens.
 */

export async function parseGoogleForm(rawUrl) {
  let url = rawUrl.trim();

  // If user passed edit link or response link, normalize to viewform if possible
  if (url.includes('/edit')) {
    // Keep it or convert to viewform, but fetch works on both if permissions allow
    url = url.replace(/\/edit.*$/, '/viewform');
  }

  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
  ];

  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgents[0],
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Không thể tải trang Google Form (HTTP ${response.status}: ${response.statusText})`);
  }

  const html = await response.text();
  const finalUrl = response.url;

  // Extract Form ID
  let formId = '';
  const idMatch = finalUrl.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    formId = idMatch[1];
  }

  // Check if form requires login
  const requiresLogin = html.includes('accounts.google.com/ServiceLogin') || 
                        html.includes('Bắt buộc phải đăng nhập') ||
                        html.includes('Sign in to your Google Account');

  // Extract fbzx token (anti-replay token)
  let fbzx = null;
  const fbzxMatch = html.match(/name="fbzx"\s+value="([^"]+)"/) || html.match(/data-fbzx="([^"]+)"/);
  if (fbzxMatch) {
    fbzx = fbzxMatch[1];
  }

  // Extract form title
  let title = 'Google Form';
  const titleTagMatch = html.match(/<meta property="og:title" content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/);
  if (titleTagMatch) {
    title = titleTagMatch[1].replace(/ - Google Biểu mẫu| - Google Forms/, '').trim();
  }

  // Extract description
  let description = '';
  const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
  if (descMatch) {
    description = descMatch[1].trim();
  }

  // Extract FB_PUBLIC_LOAD_DATA_
  let rawData = null;
  const scriptMarker = 'var FB_PUBLIC_LOAD_DATA_ = ';
  const startIdx = html.indexOf(scriptMarker);

  if (startIdx !== -1) {
    const afterMarker = html.slice(startIdx + scriptMarker.length);
    const endIdx = afterMarker.indexOf(';</script>');
    if (endIdx !== -1) {
      const jsonStr = afterMarker.slice(0, endIdx).trim();
      try {
        rawData = JSON.parse(jsonStr);
      } catch (e) {
        // Fallback eval attempt if JSON.parse fails due to loose quotes
        try {
          rawData = new Function(`return ${jsonStr}`)();
        } catch (err) {
          console.warn('Lỗi parse FB_PUBLIC_LOAD_DATA_:', err.message);
        }
      }
    }
  }

  const questions = [];
  let formAction = `https://docs.google.com/forms/d/e/${formId}/formResponse`;

  // Check if there is an explicit form action
  const formActionMatch = html.match(/<form[^>]+action="([^"]+)"/);
  if (formActionMatch) {
    formAction = formActionMatch[1];
  }

  let currentSectionIndex = 0;
  let currentSectionTitle = 'Phần 1: Khởi đầu';
  const sections = [{ index: 0, title: currentSectionTitle, description: '', questionCount: 0 }];

  if (rawData && Array.isArray(rawData[1]) && Array.isArray(rawData[1][1])) {
    const rawItems = rawData[1][1];

    for (const item of rawItems) {
      if (!Array.isArray(item)) continue;

      const itemId = item[0];
      const qTitle = item[1] || 'Câu hỏi không tiêu đề';
      const qDesc = item[2] || '';
      const typeCode = item[3];
      const payloadMeta = item[4];

      // Type 8 is Section Header / Page Break (Thêm phần mới)
      if (typeCode === 8) {
        currentSectionIndex++;
        currentSectionTitle = qTitle || `Phần ${currentSectionIndex + 1}`;
        sections.push({
          index: currentSectionIndex,
          title: currentSectionTitle,
          description: qDesc,
          questionCount: 0
        });
        questions.push({
          type: 'SECTION_HEADER',
          title: currentSectionTitle,
          description: qDesc,
          sectionIndex: currentSectionIndex,
          isSection: true
        });
        continue;
      }

      if (!Array.isArray(payloadMeta) || payloadMeta.length === 0) continue;

      // Handle Type 7: GRID (Lưới trắc nghiệm nhiều dòng / Multiple Choice Grid)
      if (typeCode === 7) {
        let colOptions = [];
        if (payloadMeta[0] && Array.isArray(payloadMeta[0][1])) {
          colOptions = payloadMeta[0][1].map(opt => Array.isArray(opt) ? opt[0] : opt).filter(Boolean);
        }
        if (colOptions.length === 0) {
          colOptions = ['1', '2', '3', '4', '5'];
        }

        for (let r = 0; r < payloadMeta.length; r++) {
          const rowMeta = payloadMeta[r];
          if (!rowMeta) continue;
          const entryId = rowMeta[0];
          const isRequired = Boolean(rowMeta[2] === 1);
          let rowLabel = '';
          if (Array.isArray(rowMeta[3]) && rowMeta[3].length > 0) {
            rowLabel = rowMeta[3][0] || '';
          }
          const fullTitle = rowLabel ? `${qTitle} [${rowLabel}]` : `${qTitle} (Hàng ${r + 1})`;

          if (entryId) {
            sections[currentSectionIndex].questionCount++;
            questions.push({
              id: `${itemId}_${r}`,
              entryId: `entry.${entryId}`,
              rawEntryId: entryId,
              title: fullTitle,
              description: qDesc,
              type: 'SCALE_LIKERT',
              typeCode: 7,
              sectionIndex: currentSectionIndex,
              sectionTitle: currentSectionTitle,
              isRequired,
              options: colOptions
            });
          }
        }
        continue;
      }

      const firstMeta = payloadMeta[0];
      const entryId = firstMeta ? firstMeta[0] : null;
      const isRequired = Boolean(firstMeta && firstMeta[2] === 1);

      let questionType = 'TEXT';
      let options = [];

      switch (typeCode) {
        case 0:
          questionType = 'SHORT_TEXT';
          break;
        case 1:
          questionType = 'PARAGRAPH';
          break;
        case 2:
          questionType = 'RADIO';
          if (Array.isArray(firstMeta[1])) {
            options = firstMeta[1].map(opt => Array.isArray(opt) ? opt[0] : opt).filter(Boolean);
          }
          break;
        case 3:
          questionType = 'DROPDOWN';
          if (Array.isArray(firstMeta[1])) {
            options = firstMeta[1].map(opt => Array.isArray(opt) ? opt[0] : opt).filter(Boolean);
          }
          break;
        case 4:
          questionType = 'CHECKBOX';
          if (Array.isArray(firstMeta[1])) {
            options = firstMeta[1].map(opt => Array.isArray(opt) ? opt[0] : opt).filter(Boolean);
          }
          break;
        case 5:
          questionType = 'SCALE_LIKERT';
          if (Array.isArray(firstMeta[3])) {
            const min = firstMeta[3][0] || 1;
            const max = firstMeta[3][1] || 5;
            for (let i = min; i <= max; i++) {
              options.push(String(i));
            }
          } else {
            options = ['1', '2', '3', '4', '5'];
          }
          break;
        default:
          questionType = `OTHER_${typeCode}`;
      }

      if (entryId) {
        sections[currentSectionIndex].questionCount++;
        questions.push({
          id: itemId,
          entryId: `entry.${entryId}`,
          rawEntryId: entryId,
          title: qTitle,
          description: qDesc,
          type: questionType,
          typeCode,
          sectionIndex: currentSectionIndex,
          sectionTitle: currentSectionTitle,
          isRequired,
          options
        });
      }
    }
  }

  const pageCount = sections.length;
  // Multi-section Google Form requires pageHistory sequence: "0,1" for 2 pages, "0,1,2" for 3 pages, etc.
  const pageHistory = Array.from({ length: pageCount }, (_, i) => i).join(',');

  return {
    success: true,
    url: finalUrl,
    formId,
    formAction,
    title,
    description,
    fbzx,
    requiresLogin,
    pageCount,
    pageHistory,
    sections,
    questionCount: questions.filter(q => !q.isSection).length,
    questions
  };
}
