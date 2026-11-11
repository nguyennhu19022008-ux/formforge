/**
 * FormForge - Form Submission & Payload Dispatcher
 * Dispatches HTTP POST requests to Google Forms with Instant or Throttled pacing.
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
];

/**
 * Submit a single response payload to Google Form endpoint
 */
export async function submitSingleResponse(formAction, payload, fbzx = null, pageHistory = '0') {
  const startTime = Date.now();
  const searchParams = new URLSearchParams();

  // Attach all entry values
  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value)) {
      // For checkboxes, repeat key
      for (const item of value) {
        searchParams.append(key, item);
      }
    } else {
      searchParams.append(key, value);
    }
  }

  // Google Form standard metadata
  searchParams.append('fvv', '1');
  searchParams.append('draftResponse', '[]');
  searchParams.append('pageHistory', pageHistory || '0');
  if (fbzx) {
    searchParams.append('fbzx', fbzx);
  }

  const randomUa = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  try {
    const response = await fetch(formAction, {
      method: 'POST',
      headers: {
        'User-Agent': randomUa,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': formAction.replace('/formResponse', '/viewform'),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      body: searchParams.toString(),
      redirect: 'follow'
    });

    const latencyMs = Date.now() - startTime;
    const isSuccess = response.status === 200 || response.status === 302;

    return {
      success: isSuccess,
      status: response.status,
      statusText: response.statusText,
      latencyMs,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      status: 0,
      error: err.message,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Dispatch an entire batch with configurable pacing and concurrency
 */
export async function dispatchBatch(formAction, batch, fbzx = null, options = {}, onProgress = null) {
  const {
    mode = 'instant', // 'instant' | 'throttled' | 'parallel'
    concurrency = 1,
    pageHistory = '0',
    minDelayMs = 500,
    maxDelayMs = 2000
  } = options;

  const results = [];

  if (concurrency > 1 || mode === 'parallel') {
    const poolSize = Math.max(1, concurrency || 5);
    let currentIndex = 0;

    async function worker(workerId) {
      while (currentIndex < batch.length) {
        const i = currentIndex++;
        const payload = batch[i];
        const res = await submitSingleResponse(formAction, payload, fbzx, pageHistory);
        const progressItem = {
          index: i + 1,
          workerId,
          total: batch.length,
          ...res
        };
        results.push(progressItem);
        if (typeof onProgress === 'function') {
          onProgress(progressItem);
        }
      }
    }

    const workers = [];
    for (let w = 1; w <= poolSize; w++) {
      workers.push(worker(w));
    }
    await Promise.all(workers);

  } else {
    for (let i = 0; i < batch.length; i++) {
      const payload = batch[i];
      const res = await submitSingleResponse(formAction, payload, fbzx, pageHistory);
      const progressItem = {
        index: i + 1,
        total: batch.length,
        ...res
      };

      results.push(progressItem);
      if (typeof onProgress === 'function') {
        onProgress(progressItem);
      }

      // Delay handling
      if (i < batch.length - 1) {
        if (mode === 'throttled') {
          const delay = Math.floor(minDelayMs + Math.random() * (maxDelayMs - minDelayMs));
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Subtle micro-delay to prevent socket flooding
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
    }
  }

  return {
    total: batch.length,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length,
    results
  };
}
