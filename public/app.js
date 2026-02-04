/**
 * Reddit Insights Frontend Application
 * Handles form submission, loading state, and results rendering
 */

// DOM Elements
const form = document.getElementById('analyze-form');
const subredditInput = document.getElementById('subreddit');
const periodSelect = document.getElementById('period');
const limitInput = document.getElementById('limit');
const analyzeBtn = document.getElementById('analyze-btn');
const btnText = analyzeBtn.querySelector('.btn-text');
const btnLoading = analyzeBtn.querySelector('.btn-loading');
const errorContainer = document.getElementById('error-container');
const errorText = document.getElementById('error-text');
const loadingContainer = document.getElementById('loading-container');
const loadingStatus = document.getElementById('loading-status');
const resultsContainer = document.getElementById('results-container');
const resultsSubreddit = document.getElementById('results-subreddit');
const resultsStats = document.getElementById('results-stats');
const resultsContent = document.getElementById('results-content');

/**
 * Show error message
 */
function showError(message) {
  errorText.textContent = message;
  errorContainer.hidden = false;
  loadingContainer.hidden = true;
  resultsContainer.hidden = true;
}

/**
 * Hide error message
 */
function hideError() {
  errorContainer.hidden = true;
}

/**
 * Show loading state
 */
function showLoading() {
  loadingContainer.hidden = false;
  resultsContainer.hidden = true;
  hideError();
  setLoadingStatus('Fetching posts from Reddit...');
}

/**
 * Hide loading state
 */
function hideLoading() {
  loadingContainer.hidden = true;
}

/**
 * Update loading status message
 */
function setLoadingStatus(message) {
  loadingStatus.textContent = message;
}

/**
 * Set button loading state
 */
function setButtonLoading(loading) {
  analyzeBtn.disabled = loading;
  btnText.hidden = loading;
  btnLoading.hidden = !loading;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convert frequency to badge HTML
 */
function frequencyBadge(frequency) {
  const colors = {
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low'
  };
  const icons = {
    high: '&#128308;', // red circle
    medium: '&#128993;', // yellow circle
    low: '&#128994;' // green circle
  };
  return `<span class="badge ${colors[frequency] || 'badge-low'}">${icons[frequency] || ''} ${frequency}</span>`;
}

/**
 * Convert confidence to badge HTML
 */
function confidenceBadge(confidence) {
  const icons = {
    high: '&#9989;', // check
    medium: '&#128310;', // orange diamond
    low: '&#10067;' // question mark
  };
  return `<span class="badge badge-${confidence}">${icons[confidence] || ''} ${confidence} confidence</span>`;
}

/**
 * Render analysis results as HTML
 */
function renderAnalysis(analysis) {
  const sections = [];

  // TL;DR
  if (analysis.tldr) {
    sections.push(`
      <h2>TL;DR</h2>
      <p>${escapeHtml(analysis.tldr)}</p>
    `);
  }

  // Pain Points
  if (analysis.pains && analysis.pains.length > 0) {
    let painHtml = '<h2>Pain Points</h2>';
    for (const pain of analysis.pains) {
      const mentionText = pain.mentionCount > 0 ? ` (~${pain.mentionCount} mentions)` : '';
      painHtml += `
        <div class="section-card">
          <div class="section-card-title">
            ${frequencyBadge(pain.frequency)}
            <strong>${escapeHtml(pain.description)}${mentionText}</strong>
          </div>
          ${pain.evidence && pain.evidence.length > 0 ? `
            <div style="margin-top: 0.5rem;">
              ${pain.evidence.slice(0, 3).map(ev => `<blockquote>"${escapeHtml(ev)}"</blockquote>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }
    sections.push(painHtml);
  }

  // User Desires
  if (analysis.desires && analysis.desires.length > 0) {
    let desireHtml = '<h2>User Desires</h2>';
    for (const desire of analysis.desires) {
      const mentionText = desire.mentionCount > 0 ? ` (~${desire.mentionCount} mentions)` : '';
      desireHtml += `
        <div class="section-card">
          <div class="section-card-title">
            ${frequencyBadge(desire.frequency)}
            <strong>${escapeHtml(desire.description)}${mentionText}</strong>
          </div>
          ${desire.evidence && desire.evidence.length > 0 ? `
            <div style="margin-top: 0.5rem;">
              ${desire.evidence.slice(0, 3).map(ev => `<blockquote>"${escapeHtml(ev)}"</blockquote>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }
    sections.push(desireHtml);
  }

  // Audience Language
  if (analysis.userLanguage) {
    const lang = analysis.userLanguage;
    if (lang.commonTerms?.length > 0 || lang.emotionalPatterns?.length > 0) {
      let langHtml = '<h2>Audience Language</h2>';
      langHtml += `<p><strong>Overall Tone:</strong> ${escapeHtml(lang.tone || 'Unknown')}</p>`;

      if (lang.commonTerms && lang.commonTerms.length > 0) {
        langHtml += `<p><strong>Common Terms:</strong> ${lang.commonTerms.map(t => `<code>${escapeHtml(t)}</code>`).join(', ')}</p>`;
      }

      if (lang.emotionalPatterns && lang.emotionalPatterns.length > 0) {
        langHtml += `<p><strong>Emotional Patterns:</strong></p><ul>${lang.emotionalPatterns.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`;
      }
      sections.push(langHtml);
    }
  }

  // Product Hypotheses
  if (analysis.hypotheses && analysis.hypotheses.length > 0) {
    let hypoHtml = '<h2>Product Hypotheses</h2>';
    for (const hypothesis of analysis.hypotheses) {
      hypoHtml += `
        <div class="section-card">
          <div class="section-card-title">
            ${confidenceBadge(hypothesis.confidence)}
          </div>
          <p style="margin: 0.5rem 0;"><strong>${escapeHtml(hypothesis.statement)}</strong></p>
          ${hypothesis.supportingEvidence && hypothesis.supportingEvidence.length > 0 ? `
            <p style="margin-top: 0.5rem;"><em>Supporting Evidence:</em></p>
            <ul>${hypothesis.supportingEvidence.map(ev => `<li>${escapeHtml(ev)}</li>`).join('')}</ul>
          ` : ''}
        </div>
      `;
    }
    sections.push(hypoHtml);
  }

  // Behavioral Patterns
  if (analysis.patterns && analysis.patterns.length > 0) {
    let patternHtml = '<h2>Behavioral Patterns</h2>';
    for (const pattern of analysis.patterns) {
      patternHtml += `
        <div class="section-card">
          <h3 style="margin: 0 0 0.5rem 0;">${escapeHtml(pattern.name)}</h3>
          <p>${escapeHtml(pattern.description)}</p>
          <p style="color: var(--color-text-secondary); font-size: 0.9rem;"><em>Observed in ~${pattern.occurrences} discussions</em></p>
        </div>
      `;
    }
    sections.push(patternHtml);
  }

  // Notable Quotes
  if (analysis.quotes && analysis.quotes.length > 0) {
    let quotesHtml = '<h2>Notable Quotes</h2>';
    for (const quote of analysis.quotes) {
      quotesHtml += `
        <blockquote>
          "${escapeHtml(quote.text)}"
          <footer style="margin-top: 0.5rem; font-style: normal; font-size: 0.85rem;">
            &mdash; u/${escapeHtml(quote.author)} (score: ${quote.score}) | <em>${escapeHtml(quote.context)}</em>
          </footer>
        </blockquote>
      `;
    }
    sections.push(quotesHtml);
  }

  return sections.join('');
}

/**
 * Show results
 */
function showResults(data) {
  resultsSubreddit.textContent = `r/${data.subreddit}`;
  resultsStats.textContent = `${data.postsAnalyzed} posts, ${data.totalComments} comments analyzed`;
  resultsContent.innerHTML = renderAnalysis(data.analysis);
  resultsContainer.hidden = false;
  hideLoading();
}

/**
 * Submit analysis request
 */
async function submitAnalysis(event) {
  event.preventDefault();

  const subreddit = subredditInput.value.trim();
  const period = periodSelect.value;
  const limit = parseInt(limitInput.value, 10) || 50;

  if (!subreddit) {
    showError('Please enter a subreddit name');
    return;
  }

  hideError();
  showLoading();
  setButtonLoading(true);

  try {
    // Start analysis
    setLoadingStatus('Fetching posts from Reddit...');

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subreddit, period, limit }),
    });

    const result = await response.json();

    if (!result.success) {
      showError(result.error || 'An error occurred during analysis');
      return;
    }

    showResults(result.data);
  } catch (error) {
    console.error('Analysis error:', error);
    showError(error.message || 'Failed to connect to the server');
  } finally {
    setButtonLoading(false);
  }
}

// Event listeners
form.addEventListener('submit', submitAnalysis);

// Check server health on load
async function checkHealth() {
  try {
    const response = await fetch('/health');
    const data = await response.json();

    if (!data.apiKeyConfigured) {
      showError('OpenAI API key is not configured on the server. Please set the OPENAI_API_KEY environment variable.');
    }
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

checkHealth();
