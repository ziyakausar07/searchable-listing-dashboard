# Searchable — Dynamic Project & Opportunity Listing Dashboard

A modern, responsive, and interactive **Searchable Listing Dashboard** built strictly using **HTML5**, **CSS3**, and **Vanilla JavaScript (ES6+)**. This application allows users to discover project listings and tech roles through real-time debounced multi-field search, multi-category AND/OR filtering, dynamic sorting, client-side pagination, accessible modal views, bookmarking, and resilient state handling (loading skeletons, empty search, and network error recovery).

---

## 🌟 Live Demo & Repository
- **GitHub Repository**: [https://github.com/ziyakausar07/searchable](https://github.com/ziyakausar07/searchable)
- **Live Demo (GitHub Pages)**: [https://ziyakausar07.github.io/searchable/](https://ziyakausar07.github.io/searchable/)

---

## 🚀 Key Features

### 1. 🔍 Instant Debounced Search
- Searches simultaneously across **Listing Title**, **Required Skills**, **Description**, and **Search Keywords**.
- **250ms Debounce Delay** prevents lag and excessive re-renders while typing.
- Case-insensitive substring matching with leading/trailing whitespace trimming.
- **Search Term Highlighting**: Matches are cleanly highlighted with `<mark class="highlight">` in card titles, descriptions, and skill tags without breaking HTML formatting.
- Quick search clear (`✕`) button and trending quick-tag chips (e.g., *JavaScript*, *Python*, *AWS*, *Figma*, *AI*).

### 2. 🎯 Compound Category Filtering (AND / OR Logic)
- **Domain Categories**: Web Development, Data Science, Cybersecurity, UI/UX Design, Artificial Intelligence, and Cloud Computing.
- **Experience Levels**: Beginner, Intermediate, and Advanced.
- **Work Modes**: Remote, Hybrid, and On-site.
- **Logical Rules**:
  - **Logical AND** between different filter categories (e.g., `Domain == "Web Development"` **AND** `WorkMode == "Remote"` **AND** `Search == "Node"`).
  - **Logical OR** within multi-select groups (e.g., selecting both *Remote* and *Hybrid* displays listings matching either mode).
- **Active Filter Pills Bar**: Visual dismissible chips for each active filter with one-click removal.
- **Live Category Count Indicators**: Displays the exact number of opportunities available for each option.
- **Global Reset**: "Clear All Filters" restores the entire dataset instantly.

### 3. 📊 Dynamic Client-Side Sorting
- **Newest First**: Sorts by `postedDate` descending.
- **Oldest First**: Sorts by `postedDate` ascending.
- **Title: A–Z**: Alphabetical sort (case-insensitive `localeCompare`).
- **Title: Z–A**: Reverse alphabetical sort.
- Sorting works seamlessly with all active search queries and filter selections without mutating the source dataset.

### 4. 📄 Responsive Pagination
- **6 listings per page** by default.
- Dynamic page number buttons with smart ellipsis (`1 ... 4 5 6 ... 10`) for clean navigation.
- Previous / Next navigation buttons with accessible disabled states on boundary pages.
- Automatically recalculates total pages whenever search or filters change, safely resetting to Page 1.
- Smooth scroll to top of listings grid upon page navigation.

### 5. 🪟 Accessible Listing Details Modal
- Click **"View Details"** on any card to inspect full role requirements, tech stack tags, keywords, duration, and metadata.
- **Accessibility (A11y)**:
  - Supports dismissal with the **Escape** key, backdrop click, or close button.
  - Returns focus to the trigger button upon closure.
  - Proper ARIA attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- Interactive actions: **Save Opportunity (Bookmark)**, **Share Listing** (copies link to clipboard), and **Apply Now** with toast notification feedback.

### 6. 🎨 User Experience States & Themes
- **Loading State**: Beautiful animated skeleton cards with CSS shimmer effect during initial fetch.
- **Empty State**: Friendly illustration, helpful recovery tips, and a direct "Clear All Filters" CTA when no listings match.
- **Error State**: Graceful fallback UI with a "Try Again" button that retries the fetch request on failure.
- **Dark / Light Theme Toggle**: Seamless CSS variables-based theme switcher with `localStorage` persistence.
- **Responsive Mobile Drawer**: Off-canvas filter drawer and mobile navigation for seamless touch screens (320px–1024px+).

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Markup** | HTML5 | Semantic elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<fieldset>`), ARIA attributes |
| **Styling** | Vanilla CSS3 | CSS Grid, Flexbox, CSS Variables (Design Tokens), Glassmorphism, Responsive Media Queries |
| **Logic** | Vanilla JavaScript (ES6+) | Native Fetch API, Array methods (`filter`, `map`, `sort`, `slice`), Debouncing, DOM events |
| **Typography** | Google Fonts | *Plus Jakarta Sans* (Headings) & *Inter* (Body text) |
| **Icons** | Clean Inline SVGs | Lightweight, scalable vector icons without third-party icon libraries |
| **Storage** | Local JSON / Web Storage | `data/listings.json` dataset + `localStorage` for theme and saved bookmarks |

*No React, Vue, Angular, Bootstrap, or Tailwind CSS used.*

---

## 📂 Project Structure

```
searchable/
├── index.html              # Main HTML5 application file
├── css/
│   └── style.css           # Vanilla CSS3 styling, design tokens & dark/light themes
├── js/
│   └── app.js              # Core application logic, filtering, sorting, pagination
├── data/
│   └── listings.json       # Mock dataset containing 20 diverse listings
├── assets/
│   └── icons/
│       └── logo.svg        # Scalable application brand icon
└── README.md               # Project documentation & setup guide
```

---

## 📋 JSON Dataset Schema

Each item in `data/listings.json` adheres to the following specification:

```json
{
  "id": 1,
  "title": "Frontend Developer Intern",
  "domain": "Web Development",
  "description": "Build responsive and accessible web interfaces using modern HTML5, CSS3, and JavaScript standards. Collaborate with designers to turn wireframes into interactive prototypes.",
  "skills": ["HTML", "CSS", "JavaScript", "Responsive Design", "Git"],
  "experienceLevel": "Beginner",
  "workMode": "Remote",
  "postedDate": "2026-10-12",
  "duration": "3 months",
  "type": "Internship",
  "keywords": ["frontend", "web", "ui", "javascript", "intern", "html", "css"]
}
```

The dataset includes **20 diverse listings** representing:
- **Domains**: Web Development, Data Science, Cybersecurity, UI/UX Design, Artificial Intelligence, and Cloud Computing.
- **Experience Levels**: Beginner, Intermediate, and Advanced.
- **Work Modes**: Remote, Hybrid, and On-site.

---

## 🧠 Algorithmic Explanations

### 1. Search Algorithm & Multi-field Matching
When a user types into the search bar, the input is trimmed and split into individual word tokens. A listing is considered a match if **all** typed word tokens are present (as a case-insensitive substring) anywhere in:
- The listing title
- The job description
- The domain name
- The list of required skills
- The assigned keywords

```javascript
const query = AppState.filters.searchQuery.trim().toLowerCase();
const searchTerms = query.split(/\s+/).filter(Boolean);

const combinedSearchText = `${titleLower} ${descLower} ${domainLower} ${skillsLower} ${keywordsLower}`;
const matchesAllTerms = searchTerms.every(term => combinedSearchText.includes(term));
```

### 2. Compound Filtering (Logical AND / OR)
The filtering pipeline uses two nested boolean operations:
1. **Within a Category (Logical OR)**: If the user selects both "Remote" and "Hybrid", a listing matches if its `workMode` is *either* Remote or Hybrid (`selectedModes.has(listing.workMode)`).
2. **Across Categories (Logical AND)**: For a listing to be included, it must satisfy:
   $$\text{Domain Match} \land \text{Experience Match} \land \text{Work Mode Match} \land \text{Search Match}$$

### 3. Search Debounce (250ms)
- **Why Debounce?** Without debouncing, every keystroke immediately triggers filtering across the entire dataset, DOM destruction, and DOM creation. Typing "Developer" would trigger 9 full filter and render cycles.
- **Implementation**: The debouncing utility holds a timer and delays execution until 250 milliseconds have elapsed without any new keystroke:
```javascript
function debounce(fn, delay = 250) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

### 4. Sorting & Pagination Pipeline
To guarantee predictable state transitions and prevent bugs, data flows through a strict unidirectional pipeline:
$$\mathbf{Raw\ Dataset} \longrightarrow \mathbf{Filter} \longrightarrow \mathbf{Sort} \longrightarrow \mathbf{Paginate\ (Slice)} \longrightarrow \mathbf{Render}$$

1. **Immutability**: `AppState.rawListings` is frozen (`Object.freeze`). Sorting creates a shallow copy (`[...dataset]`) so the original order remains preserved.
2. **Pagination Slicing**: Only the current page items are rendered to the DOM:
   $$\text{startIndex} = (\text{currentPage} - 1) \times \text{itemsPerPage}$$
   $$\text{endIndex} = \min(\text{startIndex} + \text{itemsPerPage}, \text{totalFilteredItems})$$

---

## 💻 Local Setup & Execution Instructions

Follow these simple steps to run the dashboard locally on your machine:

### Option A: Using Python (Recommended)
1. Open your terminal or PowerShell in the project directory:
   ```bash
   cd e:/Tasks/searchable
   ```
2. Start Python's built-in HTTP server:
   ```bash
   python -m http.server 8080
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

### Option B: Using Node.js `npx serve`
1. Run the static server:
   ```bash
   npx serve . -p 8080
   ```
2. Open `http://localhost:8080` in your browser.

### Option C: VS Code Live Server
1. Open the project folder in VS Code.
2. Right-click `index.html` and select **"Open with Live Server"**.

---

## 🚀 GitHub Repository & Deployment Instructions

### 1. Push to GitHub
```bash
# Add all files to git tracking
git add .

# Create initial commit
git commit -m "feat: complete Searchable Listing Dashboard with filters, search, sorting and pagination"

# Ensure main branch is active
git branch -M main

# Push to the remote repository
git push -u origin main
```

### 2. Deploy to GitHub Pages (Free)
1. Go to your repository on GitHub: `https://github.com/ziyakausar07/searchable`
2. Click **Settings** > **Pages** (in the left sidebar).
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`.
   - **Branch**: Select `main` and `/ (root)` folder.
4. Click **Save**.
5. Within 1–2 minutes, your live site will be accessible at:
   `https://ziyakausar07.github.io/searchable/`

### 3. Deploy to Netlify (Alternative)
1. Log in to [Netlify](https://www.netlify.com/).
2. Click **Add new site** > **Import an existing project**.
3. Connect your GitHub account and select `ziyakausar07/searchable`.
4. Leave build command empty and publish directory as `.`.
5. Click **Deploy Site**.

---

## 🔮 Future Enhancements
- [ ] Export filtered listings to CSV or JSON.
- [ ] User authentication with saved application history.
- [ ] Salary range slider filter.
- [ ] Integration with live Job Board APIs (e.g., GitHub Jobs, RemoteOK).

---

## 📄 License
This project is open-source and available under the **MIT License**.
