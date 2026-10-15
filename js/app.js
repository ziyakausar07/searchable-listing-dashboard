/**
 * Searchable Listing Dashboard - Core Application Logic
 * Vanilla JavaScript (ES6+) Implementation
 */

// Global Application State
const AppState = {
  rawListings: [],          // Original immutable dataset
  filteredListings: [],     // Current listings after search + filters
  sortedListings: [],       // Current listings after sorting
  
  // Active Filter Criteria
  filters: {
    searchQuery: '',
    domains: new Set(),
    experienceLevels: new Set(),
    workModes: new Set(),
  },

  // Sorting & Pagination
  sortBy: 'newest',         // newest, oldest, title-asc, title-desc
  currentPage: 1,
  itemsPerPage: 6,
  
  // UI States
  isLoading: true,
  lastError: null,
  savedListingIds: new Set(JSON.parse(localStorage.getItem('searchable_saved_ids') || '[]')),
  
  // Active modal listing
  activeListingModal: null,
  lastFocusedElement: null
};

// DOM Element Selectors Cache
const DOM = {
  // Header & Navigation
  appHeader: document.getElementById('app-header'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  savedListingsBtn: document.getElementById('saved-listings-btn'),
  savedBadgeCount: document.getElementById('saved-badge-count'),
  mobileMenuBtn: document.getElementById('mobile-menu-btn'),
  mobileNav: document.getElementById('mobile-nav'),

  // Hero & Search
  heroSearchForm: document.getElementById('hero-search-form'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  heroTotalCountText: document.getElementById('hero-total-count-text'),
  statTotalListings: document.getElementById('stat-total-listings'),
  statDomainsCount: document.getElementById('stat-domains-count'),
  statRemoteCount: document.getElementById('stat-remote-count'),
  quickTags: document.querySelectorAll('.quick-tag-chip'),

  // Dashboard Controls
  sortSelect: document.getElementById('sort-select'),
  clearAllBtn: document.getElementById('clear-all-btn'),
  sidebarResetBtn: document.getElementById('sidebar-reset-btn'),
  toggleFilterPanelBtn: document.getElementById('toggle-filter-panel-btn'),
  activeFilterBadge: document.getElementById('active-filter-badge'),
  resultsCountText: document.getElementById('results-count-text'),
  showingRangeText: document.getElementById('showing-range-text'),
  totalFilteredCount: document.getElementById('total-filtered-count'),
  activePillsContainer: document.getElementById('active-pills-container'),

  // Filters Panel
  filtersPanel: document.getElementById('filters-panel'),
  closeFiltersBtn: document.getElementById('close-filters-btn'),
  applyMobileFiltersBtn: document.getElementById('apply-mobile-filters-btn'),
  filterCheckboxes: document.querySelectorAll('.filter-checkbox'),
  filterCollapseBtns: document.querySelectorAll('.filter-collapse-btn'),

  // Listings & Pagination
  listingsGrid: document.getElementById('listings-grid'),
  paginationNav: document.getElementById('pagination-nav'),

  // Modals
  listingModal: document.getElementById('listing-modal'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  modalDomainBadge: document.getElementById('modal-domain-badge'),
  modalTypeBadge: document.getElementById('modal-type-badge'),
  modalModeBadge: document.getElementById('modal-mode-badge'),
  modalTitle: document.getElementById('modal-listing-title'),
  modalDuration: document.getElementById('modal-duration'),
  modalExperience: document.getElementById('modal-experience'),
  modalPostedDate: document.getElementById('modal-posted-date'),
  modalDescription: document.getElementById('modal-description'),
  modalSkillsContainer: document.getElementById('modal-skills-container'),
  modalKeywordsContainer: document.getElementById('modal-keywords-container'),
  modalSaveBtn: document.getElementById('modal-save-btn'),
  modalSaveText: document.getElementById('modal-save-text'),
  modalShareBtn: document.getElementById('modal-share-btn'),
  modalApplyBtn: document.getElementById('modal-apply-btn'),

  // Saved Modal
  savedModal: document.getElementById('saved-modal'),
  savedModalBackdrop: document.getElementById('saved-modal-backdrop'),
  savedCloseBtn: document.getElementById('saved-close-btn'),
  savedListingsList: document.getElementById('saved-listings-list'),

  // Toast Container
  toastContainer: document.getElementById('toast-container')
};

/* ==========================================================================
   1. Data Fetching & Validation
   ========================================================================== */

/**
 * Fetch and validate the local JSON dataset
 * @param {string} [url='data/listings.json']
 * @returns {Promise<Array>}
 */
async function fetchListings(url = 'data/listings.json') {
  AppState.isLoading = true;
  AppState.lastError = null;
  renderSkeletonCards();

  try {
    const response = await fetch(url, { cache: 'no-cache' });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} (${response.statusText})`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Invalid data format: Expected an array of listings.');
    }

    // Validate listing schema
    const validatedData = data.filter((item, index) => {
      const isValid = (
        item &&
        typeof item.id !== 'undefined' &&
        typeof item.title === 'string' &&
        typeof item.domain === 'string' &&
        typeof item.description === 'string' &&
        Array.isArray(item.skills)
      );
      if (!isValid) {
        console.warn(`Listing at index ${index} is missing mandatory fields. Skipping.`);
      }
      return isValid;
    });

    if (validatedData.length === 0) {
      throw new Error('Dataset contains no valid listings.');
    }

    // Set immutable raw data
    AppState.rawListings = Object.freeze(validatedData);
    AppState.isLoading = false;

    // Update hero counters and filter counts
    updateHeroCounters();
    updateCategoryOptionCounts();

    // Run complete dashboard update pipeline
    updateDashboard();

    return AppState.rawListings;
  } catch (error) {
    console.error('fetchListings error:', error);
    AppState.isLoading = false;
    AppState.lastError = error.message;
    showErrorState(error.message);
    return [];
  }
}

/* ==========================================================================
   2. Search and Filtering Logic
   ========================================================================== */

/**
 * Filter listings based on active search query and category filters.
 * Logical AND between different filter categories (Domain AND Experience AND Mode AND Search)
 * Logical OR within the same category group (e.g. Remote OR Hybrid)
 * @param {Array} dataset
 * @returns {Array}
 */
function filterListings(dataset = AppState.rawListings) {
  if (!dataset || !Array.isArray(dataset)) return [];

  const query = AppState.filters.searchQuery.trim().toLowerCase();
  const searchTerms = query ? query.split(/\s+/).filter(Boolean) : [];

  const selectedDomains = AppState.filters.domains;
  const selectedExperiences = AppState.filters.experienceLevels;
  const selectedModes = AppState.filters.workModes;

  return dataset.filter(listing => {
    // 1. Category Filter: Domain (OR within category)
    if (selectedDomains.size > 0 && !selectedDomains.has(listing.domain)) {
      return false;
    }

    // 2. Category Filter: Experience Level (OR within category)
    if (selectedExperiences.size > 0 && !selectedExperiences.has(listing.experienceLevel)) {
      return false;
    }

    // 3. Category Filter: Work Mode (OR within category)
    if (selectedModes.size > 0 && !selectedModes.has(listing.workMode)) {
      return false;
    }

    // 4. Search Query matching: title, description, skills, and keywords
    if (searchTerms.length > 0) {
      const titleLower = (listing.title || '').toLowerCase();
      const descLower = (listing.description || '').toLowerCase();
      const domainLower = (listing.domain || '').toLowerCase();
      const skillsLower = (listing.skills || []).map(s => s.toLowerCase()).join(' ');
      const keywordsLower = (listing.keywords || []).map(k => k.toLowerCase()).join(' ');

      const combinedSearchText = `${titleLower} ${descLower} ${domainLower} ${skillsLower} ${keywordsLower}`;

      // All search words must be present in the listing (sub-string match)
      const matchesAllTerms = searchTerms.every(term => combinedSearchText.includes(term));
      if (!matchesAllTerms) {
        return false;
      }
    }

    return true;
  });
}

/* ==========================================================================
   3. Sorting Logic
   ========================================================================== */

/**
 * Sort listings based on AppState.sortBy without mutating original array
 * @param {Array} dataset
 * @param {string} sortBy
 * @returns {Array}
 */
function sortListings(dataset, sortBy = AppState.sortBy) {
  if (!dataset || !Array.isArray(dataset)) return [];

  // Create shallow copy to maintain purity
  const sorted = [...dataset];

  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.postedDate || 0) - new Date(a.postedDate || 0));

    case 'oldest':
      return sorted.sort((a, b) => new Date(a.postedDate || 0) - new Date(b.postedDate || 0));

    case 'title-asc':
      return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    case 'title-desc':
      return sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));

    default:
      return sorted;
  }
}

/* ==========================================================================
   4. Pagination Logic
   ========================================================================== */

/**
 * Render pagination controls and page indicator
 * @param {number} totalItems
 * @param {number} itemsPerPage
 * @param {number} currentPage
 */
function renderPagination(totalItems, itemsPerPage = AppState.itemsPerPage, currentPage = AppState.currentPage) {
  const container = DOM.paginationNav;
  if (!container) return;

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  // Don't render pagination if 0 or 1 page
  if (totalItems <= itemsPerPage) {
    container.innerHTML = '';
    return;
  }

  // Ensure current page does not exceed total pages
  if (currentPage > totalPages) {
    AppState.currentPage = totalPages;
    currentPage = totalPages;
  }

  let html = '';

  // Previous Button
  const isPrevDisabled = currentPage <= 1;
  html += `
    <button 
      class="pagination-btn pagination-prev" 
      data-page="${currentPage - 1}" 
      ${isPrevDisabled ? 'disabled aria-disabled="true"' : ''}
      aria-label="Previous Page"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
      <span>Prev</span>
    </button>
  `;

  // Page Numbers with smart ellipsis
  const pageNumbers = getPaginationPages(currentPage, totalPages);

  pageNumbers.forEach(page => {
    if (page === '...') {
      html += `<span class="pagination-ellipsis" aria-hidden="true">&hellip;</span>`;
    } else {
      const isActive = page === currentPage;
      html += `
        <button 
          class="pagination-btn ${isActive ? 'active' : ''}" 
          data-page="${page}" 
          aria-label="Page ${page}" 
          aria-current="${isActive ? 'page' : 'false'}"
        >
          ${page}
        </button>
      `;
    }
  });

  // Next Button
  const isNextDisabled = currentPage >= totalPages;
  html += `
    <button 
      class="pagination-btn pagination-next" 
      data-page="${currentPage + 1}" 
      ${isNextDisabled ? 'disabled aria-disabled="true"' : ''}
      aria-label="Next Page"
    >
      <span>Next</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
  `;

  container.innerHTML = html;

  // Attach event listeners to pagination buttons
  container.querySelectorAll('.pagination-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPage = parseInt(btn.getAttribute('data-page'), 10);
      if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages && targetPage !== AppState.currentPage) {
        AppState.currentPage = targetPage;
        
        // Render updated page slice
        renderCurrentPageSlice();
        
        // Scroll gently back to listings top
        const listingsElem = document.getElementById('listings');
        if (listingsElem) {
          listingsElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

/**
 * Helper to determine page numbers and ellipses
 */
function getPaginationPages(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [];
  pages.push(1);

  if (current > 3) {
    pages.push('...');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push('...');
  }

  pages.push(total);
  return pages;
}

/* ==========================================================================
   5. Dynamic Rendering & Keyword Highlighting
   ========================================================================= */

/**
 * Safely highlight search keyword matches inside text
 * @param {string} text
 * @param {string} query
 * @returns {string}
 */
function highlightKeywords(text, query) {
  if (!text) return '';
  if (!query || !query.trim()) return escapeHTML(text);

  const trimmedQuery = query.trim();
  const tokens = trimmedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return escapeHTML(text);

  // Escape regex special chars for each token
  const pattern = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');

  const escaped = escapeHTML(text);
  return escaped.replace(regex, '<mark class="highlight">$1</mark>');
}

/**
 * Escape raw strings to avoid XSS injections
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format ISO date string into human friendly date
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Recently';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Dynamically generate listing cards and mount to grid
 * @param {Array} listingsToRender
 */
function renderListings(listingsToRender) {
  const grid = DOM.listingsGrid;
  if (!grid) return;

  if (!listingsToRender || listingsToRender.length === 0) {
    showEmptyState();
    return;
  }

  const query = AppState.filters.searchQuery;

  const cardsHTML = listingsToRender.map(listing => {
    const isSaved = AppState.savedListingIds.has(listing.id);
    const highlightedTitle = highlightKeywords(listing.title, query);
    const highlightedDesc = highlightKeywords(listing.description, query);

    const skillsBadges = (listing.skills || []).map(skill => {
      const highlightedSkill = highlightKeywords(skill, query);
      return `<span class="skill-tag">${highlightedSkill}</span>`;
    }).join('');

    return `
      <article class="listing-card" data-listing-id="${listing.id}" id="listing-card-${listing.id}">
        <div>
          <div class="card-top">
            <div class="card-badges-wrapper">
              <span class="badge badge-domain" data-domain="${escapeHTML(listing.domain)}">
                <span class="badge-dot" aria-hidden="true">•</span>
                ${escapeHTML(listing.domain)}
              </span>
              <span class="badge badge-mode" data-mode="${escapeHTML(listing.workMode)}">
                ${escapeHTML(listing.workMode)}
              </span>
            </div>
            
            <button 
              type="button" 
              class="card-bookmark-btn ${isSaved ? 'saved' : ''}" 
              data-bookmark-id="${listing.id}"
              aria-label="${isSaved ? 'Remove from saved' : 'Save opportunity'}"
              title="${isSaved ? 'Saved' : 'Save for later'}"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          </div>

          <h3 class="card-title">${highlightedTitle}</h3>
          <p class="card-description">${highlightedDesc}</p>
          
          <div class="card-skills-tags">
            ${skillsBadges}
          </div>
        </div>

        <div>
          <div class="card-meta-row">
            <span class="card-meta-item" title="Experience Level">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>
              <span>${escapeHTML(listing.experienceLevel)}</span>
            </span>

            <span class="card-meta-item" title="Project Duration / Type">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>${escapeHTML(listing.duration || listing.type || 'Flexible')}</span>
            </span>

            <span class="card-meta-item" title="Posted Date">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line></svg>
              <span>${formatDate(listing.postedDate)}</span>
            </span>
          </div>

          <div class="card-footer">
            <button 
              type="button" 
              class="btn-card-details" 
              data-details-id="${listing.id}"
              aria-label="View details for ${escapeHTML(listing.title)}"
            >
              <span>View Details</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  grid.innerHTML = cardsHTML;

  // Attach Details Button Event Listeners
  grid.querySelectorAll('[data-details-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(btn.getAttribute('data-details-id'), 10);
      AppState.lastFocusedElement = btn;
      openListingDetails(id);
    });
  });

  // Attach Bookmark Button Event Listeners
  grid.querySelectorAll('[data-bookmark-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.getAttribute('data-bookmark-id'), 10);
      toggleBookmark(id, btn);
    });
  });
}

/**
 * Render the current slice of items according to pagination state
 */
function renderCurrentPageSlice() {
  const totalItems = AppState.sortedListings.length;
  
  if (totalItems === 0) {
    showEmptyState();
    DOM.paginationNav.innerHTML = '';
    updateResultsCountDisplay(0, 0, 0);
    return;
  }

  const startIndex = (AppState.currentPage - 1) * AppState.itemsPerPage;
  const endIndex = Math.min(startIndex + AppState.itemsPerPage, totalItems);
  const pageSlice = AppState.sortedListings.slice(startIndex, endIndex);

  renderListings(pageSlice);
  renderPagination(totalItems, AppState.itemsPerPage, AppState.currentPage);
  updateResultsCountDisplay(startIndex + 1, endIndex, totalItems);
}

/**
 * Update the showing count summary text in UI
 */
function updateResultsCountDisplay(start, end, total) {
  if (DOM.showingRangeText) DOM.showingRangeText.textContent = `${start}–${end}`;
  if (DOM.totalFilteredCount) DOM.totalFilteredCount.textContent = total;
}

/* ==========================================================================
   6. Complete Pipeline: updateDashboard()
   ========================================================================== */

/**
 * Apply the complete search, filtering, sorting, and pagination pipeline:
 * Dataset -> Search and Filters -> Sorting -> Pagination -> Rendering
 * @param {boolean} [resetPagination=false]
 */
function updateDashboard(resetPagination = false) {
  if (resetPagination) {
    AppState.currentPage = 1;
  }

  // 1. Filtering
  AppState.filteredListings = filterListings(AppState.rawListings);

  // 2. Sorting
  AppState.sortedListings = sortListings(AppState.filteredListings, AppState.sortBy);

  // 3. Render Active Filter Pills & Count Badges
  renderActiveFilterPills();
  updateActiveFilterCounter();

  // 4. Render Current Page
  renderCurrentPageSlice();
}

/* ==========================================================================
   7. Loading, Empty, and Error States
   ========================================================================== */

/**
 * Display skeleton loading placeholder cards
 * @param {number} count
 */
function renderSkeletonCards(count = 6) {
  const grid = DOM.listingsGrid;
  if (!grid) return;

  let skeletonHTML = '';
  for (let i = 0; i < count; i++) {
    skeletonHTML += `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-badge skeleton-shimmer"></div>
        <div class="skeleton-title skeleton-shimmer"></div>
        <div class="skeleton-text skeleton-shimmer"></div>
        <div class="skeleton-text-short skeleton-shimmer"></div>
        <div class="skeleton-tags">
          <div class="skeleton-tag skeleton-shimmer"></div>
          <div class="skeleton-tag skeleton-shimmer"></div>
          <div class="skeleton-tag skeleton-shimmer"></div>
        </div>
        <div class="skeleton-footer skeleton-shimmer"></div>
      </div>
    `;
  }
  grid.innerHTML = skeletonHTML;
  DOM.paginationNav.innerHTML = '';
}

/**
 * Display empty state when no listings match the current filters
 */
function showEmptyState() {
  const grid = DOM.listingsGrid;
  if (!grid) return;

  grid.innerHTML = `
    <div class="state-container" role="status" aria-live="polite">
      <div class="state-icon-wrapper">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      </div>
      <h3 class="state-title">No listings found</h3>
      <p class="state-description">
        We couldn't find any opportunities matching your active criteria. Try broadening your keywords or removing some filters.
      </p>
      <button type="button" class="btn-primary" id="empty-state-clear-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span>Clear All Filters</span>
      </button>
    </div>
  `;

  DOM.paginationNav.innerHTML = '';
  updateResultsCountDisplay(0, 0, 0);

  // Hook up clear button inside empty state
  const clearBtn = document.getElementById('empty-state-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllFilters);
  }
}

/**
 * Display error state when dataset fetch fails
 * @param {string} [errorMessage='Unable to load listings.']
 */
function showErrorState(errorMessage = 'Unable to load listings.') {
  const grid = DOM.listingsGrid;
  if (!grid) return;

  grid.innerHTML = `
    <div class="state-container" role="alert">
      <div class="state-icon-wrapper error-state">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3 class="state-title">Unable to load listings</h3>
      <p class="state-description">
        ${escapeHTML(errorMessage)} Check your network connection or verify that data/listings.json exists.
      </p>
      <button type="button" class="btn-primary" id="error-retry-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        <span>Try Again</span>
      </button>
    </div>
  `;

  DOM.paginationNav.innerHTML = '';
  updateResultsCountDisplay(0, 0, 0);

  const retryBtn = document.getElementById('error-retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => fetchListings());
  }
}

/* ==========================================================================
   8. Filter Resets & Pill Management
   ========================================================================== */

/**
 * Clear all filters, search query, and restore complete listings dataset
 */
function clearAllFilters() {
  // Reset filter state
  AppState.filters.searchQuery = '';
  AppState.filters.domains.clear();
  AppState.filters.experienceLevels.clear();
  AppState.filters.workModes.clear();

  // Reset UI search input
  if (DOM.searchInput) {
    DOM.searchInput.value = '';
    DOM.searchInput.dispatchEvent(new Event('input'));
  }
  if (DOM.searchClearBtn) {
    DOM.searchClearBtn.hidden = true;
  }

  // Reset checkboxes
  DOM.filterCheckboxes.forEach(cb => {
    cb.checked = false;
  });

  // Re-run pipeline and reset pagination to page 1
  updateDashboard(true);
  showToast('All filters and search queries reset.');
}

/**
 * Render active filter pills with dismiss triggers
 */
function renderActiveFilterPills() {
  const container = DOM.activePillsContainer;
  if (!container) return;

  const pills = [];

  // Search pill
  if (AppState.filters.searchQuery.trim()) {
    pills.push({
      type: 'search',
      label: `"${escapeHTML(AppState.filters.searchQuery)}"`,
      value: AppState.filters.searchQuery
    });
  }

  // Domain pills
  AppState.filters.domains.forEach(domain => {
    pills.push({ type: 'domain', label: domain, value: domain });
  });

  // Experience Level pills
  AppState.filters.experienceLevels.forEach(exp => {
    pills.push({ type: 'experience', label: exp, value: exp });
  });

  // Work Mode pills
  AppState.filters.workModes.forEach(mode => {
    pills.push({ type: 'workMode', label: mode, value: mode });
  });

  if (pills.length === 0) {
    container.innerHTML = '';
    return;
  }

  const pillsHTML = pills.map(p => `
    <span class="active-pill" data-pill-type="${p.type}" data-pill-value="${escapeHTML(p.value)}">
      <span>${p.label}</span>
      <button type="button" class="active-pill-remove" aria-label="Remove filter ${escapeHTML(p.label)}" title="Remove filter">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </span>
  `).join('');

  container.innerHTML = pillsHTML;

  // Add click listener for removing individual pills
  container.querySelectorAll('.active-pill-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const pill = btn.closest('.active-pill');
      const type = pill.getAttribute('data-pill-type');
      const value = pill.getAttribute('data-pill-value');

      if (type === 'search') {
        AppState.filters.searchQuery = '';
        if (DOM.searchInput) {
          DOM.searchInput.value = '';
          DOM.searchClearBtn.hidden = true;
        }
      } else if (type === 'domain') {
        AppState.filters.domains.delete(value);
        uncheckFilterBox('domain', value);
      } else if (type === 'experience') {
        AppState.filters.experienceLevels.delete(value);
        uncheckFilterBox('experienceLevel', value);
      } else if (type === 'workMode') {
        AppState.filters.workModes.delete(value);
        uncheckFilterBox('workMode', value);
      }

      updateDashboard(true);
    });
  });
}

function uncheckFilterBox(name, value) {
  const checkbox = document.querySelector(`.filter-checkbox[name="${name}"][value="${value}"]`);
  if (checkbox) checkbox.checked = false;
}

/**
 * Update the badge counter for mobile filter toggle button
 */
function updateActiveFilterCounter() {
  const totalActive = (
    (AppState.filters.searchQuery.trim() ? 1 : 0) +
    AppState.filters.domains.size +
    AppState.filters.experienceLevels.size +
    AppState.filters.workModes.size
  );

  const badge = DOM.activeFilterBadge;
  if (!badge) return;

  if (totalActive > 0) {
    badge.textContent = totalActive;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

/* ==========================================================================
   9. Listing Details Modal Logic
   ========================================================================== */

/**
 * Display the complete information for a selected listing in accessible modal
 * @param {number} listingId
 */
function openListingDetails(listingId) {
  const listing = AppState.rawListings.find(item => item.id === listingId);
  if (!listing) return;

  AppState.activeListingModal = listing;

  // Populate Modal Fields
  DOM.modalDomainBadge.textContent = listing.domain;
  DOM.modalDomainBadge.setAttribute('data-domain', listing.domain);
  
  DOM.modalTypeBadge.textContent = listing.type || 'Opportunity';
  DOM.modalModeBadge.textContent = listing.workMode;
  DOM.modalModeBadge.setAttribute('data-mode', listing.workMode);

  DOM.modalTitle.textContent = listing.title;
  DOM.modalDuration.textContent = listing.duration || 'Flexible duration';
  DOM.modalExperience.textContent = `${listing.experienceLevel} Level`;
  DOM.modalPostedDate.textContent = `Posted ${formatDate(listing.postedDate)}`;
  DOM.modalDescription.textContent = listing.description;

  // Skills
  DOM.modalSkillsContainer.innerHTML = (listing.skills || []).map(skill => (
    `<span class="skill-tag">${escapeHTML(skill)}</span>`
  )).join('');

  // Keywords
  DOM.modalKeywordsContainer.innerHTML = (listing.keywords || []).map(keyword => (
    `<span class="keyword-tag">#${escapeHTML(keyword)}</span>`
  )).join('');

  // Save Button state
  const isSaved = AppState.savedListingIds.has(listing.id);
  updateModalSaveButton(isSaved);

  // Open Dialog
  DOM.listingModal.classList.add('open');
  DOM.listingModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Focus close button for accessibility
  DOM.modalCloseBtn.focus();
}

/**
 * Close listing details modal and return focus
 */
function closeListingDetails() {
  if (!DOM.listingModal.classList.contains('open')) return;

  DOM.listingModal.classList.remove('open');
  DOM.listingModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  AppState.activeListingModal = null;

  if (AppState.lastFocusedElement) {
    AppState.lastFocusedElement.focus();
  }
}

function updateModalSaveButton(isSaved) {
  if (!DOM.modalSaveBtn || !DOM.modalSaveText) return;
  if (isSaved) {
    DOM.modalSaveBtn.classList.add('active');
    DOM.modalSaveText.textContent = 'Saved to Portfolio';
  } else {
    DOM.modalSaveBtn.classList.remove('active');
    DOM.modalSaveText.textContent = 'Save Opportunity';
  }
}

/* ==========================================================================
   10. Bookmark & Saved Opportunities
   ========================================================================== */

function toggleBookmark(listingId, triggerBtn = null) {
  const isSaved = AppState.savedListingIds.has(listingId);

  if (isSaved) {
    AppState.savedListingIds.delete(listingId);
    showToast('Removed from saved opportunities.');
  } else {
    AppState.savedListingIds.add(listingId);
    showToast('Opportunity saved successfully!');
  }

  // Persist
  localStorage.setItem('searchable_saved_ids', JSON.stringify([...AppState.savedListingIds]));

  // Update badge counter
  updateSavedBadge();

  // Update card bookmark icon if provided
  if (triggerBtn) {
    triggerBtn.classList.toggle('saved', !isSaved);
    triggerBtn.setAttribute('aria-label', !isSaved ? 'Remove from saved' : 'Save opportunity');
    const svg = triggerBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', !isSaved ? 'currentColor' : 'none');
  }

  // If modal is open for this listing, update modal button too
  if (AppState.activeListingModal && AppState.activeListingModal.id === listingId) {
    updateModalSaveButton(!isSaved);
  }
}

function updateSavedBadge() {
  const count = AppState.savedListingIds.size;
  if (DOM.savedBadgeCount) {
    DOM.savedBadgeCount.textContent = count;
  }
}

function openSavedModal() {
  const list = DOM.savedListingsList;
  if (!list) return;

  const savedListings = AppState.rawListings.filter(item => AppState.savedListingIds.has(item.id));

  if (savedListings.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-secondary);">
        <p>No saved opportunities yet.</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-muted);">
          Click the bookmark icon on any card to save it for quick reference.
        </p>
      </div>
    `;
  } else {
    list.innerHTML = savedListings.map(listing => `
      <div class="saved-item-row">
        <div>
          <div class="saved-item-title">${escapeHTML(listing.title)}</div>
          <div class="saved-item-domain">${escapeHTML(listing.domain)} • ${escapeHTML(listing.workMode)}</div>
        </div>
        <button type="button" class="btn-outline view-saved-item-btn" data-saved-item-id="${listing.id}">View</button>
      </div>
    `).join('');

    list.querySelectorAll('.view-saved-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-saved-item-id'), 10);
        closeSavedModal();
        openListingDetails(id);
      });
    });
  }

  DOM.savedModal.classList.add('open');
  DOM.savedModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeSavedModal() {
  DOM.savedModal.classList.remove('open');
  DOM.savedModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/* ==========================================================================
   11. Toast Notifications & Helpers
   ========================================================================== */

function showToast(message, duration = 3000) {
  const container = DOM.toastContainer;
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
    </span>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-leave');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, duration);
}

/**
 * Debounce helper for high-frequency search input
 */
function debounce(fn, delay = 250) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Update hero stats counters
 */
function updateHeroCounters() {
  const total = AppState.rawListings.length;
  if (DOM.statTotalListings) DOM.statTotalListings.textContent = total;
  if (DOM.heroTotalCountText) DOM.heroTotalCountText.textContent = `${total} Live Opportunities Available`;

  const domains = new Set(AppState.rawListings.map(item => item.domain));
  if (DOM.statDomainsCount) DOM.statDomainsCount.textContent = domains.size;

  const remoteCount = AppState.rawListings.filter(item => item.workMode === 'Remote').length;
  if (DOM.statRemoteCount) DOM.statRemoteCount.textContent = `${remoteCount} Remote`;
}

/**
 * Update counts next to filter checkboxes
 */
function updateCategoryOptionCounts() {
  const listings = AppState.rawListings;

  // Domain counts
  document.querySelectorAll('[data-count-domain]').forEach(el => {
    const domainName = el.getAttribute('data-count-domain');
    const count = listings.filter(item => item.domain === domainName).length;
    el.textContent = count;
  });

  // Experience counts
  document.querySelectorAll('[data-count-exp]').forEach(el => {
    const expName = el.getAttribute('data-count-exp');
    const count = listings.filter(item => item.experienceLevel === expName).length;
    el.textContent = count;
  });

  // Work Mode counts
  document.querySelectorAll('[data-count-mode]').forEach(el => {
    const modeName = el.getAttribute('data-count-mode');
    const count = listings.filter(item => item.workMode === modeName).length;
    el.textContent = count;
  });
}

/* ==========================================================================
   12. Event Listeners Initialization
   ========================================================================== */

function initializeEventListeners() {
  // 1. Search Input with 250ms Debounce
  const handleSearchDebounced = debounce((query) => {
    AppState.filters.searchQuery = query;
    updateDashboard(true);
  }, 250);

  DOM.searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    DOM.searchClearBtn.hidden = !val;
    handleSearchDebounced(val);
  });

  // Clear Search Button
  DOM.searchClearBtn.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.searchClearBtn.hidden = true;
    AppState.filters.searchQuery = '';
    updateDashboard(true);
    DOM.searchInput.focus();
  });

  // Trending Quick Tag Chips
  DOM.quickTags.forEach(chip => {
    chip.addEventListener('click', () => {
      const term = chip.getAttribute('data-search-term');
      DOM.searchInput.value = term;
      DOM.searchClearBtn.hidden = false;
      AppState.filters.searchQuery = term;
      updateDashboard(true);

      const listingsSection = document.getElementById('listings');
      if (listingsSection) {
        listingsSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // 2. Filter Checkbox Changes
  DOM.filterCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const { name, value, checked } = checkbox;

      if (name === 'domain') {
        if (checked) AppState.filters.domains.add(value);
        else AppState.filters.domains.delete(value);
      } else if (name === 'experienceLevel') {
        if (checked) AppState.filters.experienceLevels.add(value);
        else AppState.filters.experienceLevels.delete(value);
      } else if (name === 'workMode') {
        if (checked) AppState.filters.workModes.add(value);
        else AppState.filters.workModes.delete(value);
      }

      updateDashboard(true);
    });
  });

  // Collapsible Filter Groups
  DOM.filterCollapseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('aria-controls');
      const targetList = document.getElementById(targetId);
      if (targetList) {
        const isCollapsed = targetList.classList.toggle('hidden');
        btn.classList.toggle('collapsed', isCollapsed);
        btn.setAttribute('aria-expanded', !isCollapsed);
      }
    });
  });

  // 3. Sorting Dropdown Change
  DOM.sortSelect.addEventListener('change', (e) => {
    AppState.sortBy = e.target.value;
    updateDashboard(true);
  });

  // 4. Clear All Filters Buttons
  DOM.clearAllBtn.addEventListener('click', clearAllFilters);
  DOM.sidebarResetBtn.addEventListener('click', clearAllFilters);

  // 5. Mobile Filter Drawer Toggles
  DOM.toggleFilterPanelBtn.addEventListener('click', () => {
    DOM.filtersPanel.classList.add('open');
    DOM.toggleFilterPanelBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  });

  DOM.closeFiltersBtn.addEventListener('click', () => {
    DOM.filtersPanel.classList.remove('open');
    DOM.toggleFilterPanelBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });

  DOM.applyMobileFiltersBtn.addEventListener('click', () => {
    DOM.filtersPanel.classList.remove('open');
    DOM.toggleFilterPanelBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });

  // 6. Mobile Navigation Menu Toggle
  DOM.mobileMenuBtn.addEventListener('click', () => {
    const isExpanded = DOM.mobileNav.classList.toggle('open');
    DOM.mobileMenuBtn.classList.toggle('active', isExpanded);
    DOM.mobileMenuBtn.setAttribute('aria-expanded', isExpanded);
  });

  // Close mobile nav when link is clicked
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      DOM.mobileNav.classList.remove('open');
      DOM.mobileMenuBtn.classList.remove('active');
      DOM.mobileMenuBtn.setAttribute('aria-expanded', 'false');
    });
  });

  // 7. Modals: Close Handlers (Escape Key, Backdrop, Close Button)
  DOM.modalCloseBtn.addEventListener('click', closeListingDetails);
  DOM.modalBackdrop.addEventListener('click', closeListingDetails);

  DOM.savedListingsBtn.addEventListener('click', openSavedModal);
  DOM.savedCloseBtn.addEventListener('click', closeSavedModal);
  DOM.savedModalBackdrop.addEventListener('click', closeSavedModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeListingDetails();
      closeSavedModal();
      // If mobile filters open, close them
      if (DOM.filtersPanel.classList.contains('open')) {
        DOM.filtersPanel.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
  });

  // Modal Save Opportunity Button
  DOM.modalSaveBtn.addEventListener('click', () => {
    if (!AppState.activeListingModal) return;
    toggleBookmark(AppState.activeListingModal.id);
  });

  // Modal Share Button
  DOM.modalShareBtn.addEventListener('click', async () => {
    if (!AppState.activeListingModal) return;
    const shareText = `Check out this opportunity: ${AppState.activeListingModal.title} on Searchable!`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
      showToast('Listing link copied to clipboard!');
    } else {
      showToast('Listing shared!');
    }
  });

  // Modal Apply Button
  DOM.modalApplyBtn.addEventListener('click', () => {
    if (!AppState.activeListingModal) return;
    showToast(`Application draft started for "${AppState.activeListingModal.title}"!`);
  });

  // 8. Theme Switcher (Dark/Light with localStorage persistence)
  const savedTheme = localStorage.getItem('searchable_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  DOM.themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('searchable_theme', newTheme);
    showToast(`Switched to ${newTheme} mode.`);
  });

  // 9. Sticky Header Shadow on Scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      DOM.appHeader.classList.add('scrolled');
    } else {
      DOM.appHeader.classList.remove('scrolled');
    }
  });

  // 10. Footer Category Quick Filters
  document.querySelectorAll('.footer-link-btn[data-domain-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const domain = btn.getAttribute('data-domain-filter');
      clearAllFilters();
      AppState.filters.domains.add(domain);
      const cb = document.querySelector(`.filter-checkbox[name="domain"][value="${domain}"]`);
      if (cb) cb.checked = true;
      updateDashboard(true);
      document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelectorAll('.footer-link-btn[data-exp-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const exp = btn.getAttribute('data-exp-filter');
      clearAllFilters();
      AppState.filters.experienceLevels.add(exp);
      const cb = document.querySelector(`.filter-checkbox[name="experienceLevel"][value="${exp}"]`);
      if (cb) cb.checked = true;
      updateDashboard(true);
      document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ==========================================================================
   13. Application Bootstrap
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  updateSavedBadge();
  fetchListings();
});

// Export functions to global scope for debugging or programmatic testing
window.SearchableApp = {
  fetchListings,
  renderListings,
  filterListings,
  sortListings,
  renderPagination,
  updateDashboard,
  showEmptyState,
  showErrorState,
  clearAllFilters,
  openListingDetails,
  AppState
};
