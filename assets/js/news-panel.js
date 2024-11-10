(function() {
    function initNewsPanel() {
      const newsPanel = document.querySelector('.news-panel');
      if (!newsPanel) return;
  
      const searchInput = document.getElementById('newsSearch');
      const categoryFilters = document.querySelectorAll('.category-filter');
      const newsItems = document.querySelectorAll('.news-item');
      
      // Initialize visibility data attribute for all news items
      newsItems.forEach(item => {
        item.setAttribute('data-visible', 'true');
      });
  
      // Set initial category counts once and never update them
      function setInitialCategoryCounts() {
        // Set total count for "All" category
        const allCountSpan = document.querySelector('.category-filter[data-category="all"] .category-count');
        if (allCountSpan) {
          allCountSpan.textContent = newsItems.length;
        }
  
        // Count items for each category
        const categoryCounts = {};
        newsItems.forEach(item => {
          const category = item.dataset.category;
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
  
        // Set count for each category filter
        categoryFilters.forEach(filter => {
          if (filter.dataset.category === 'all') return;
          
          const countSpan = filter.querySelector('.category-count');
          if (countSpan) {
            countSpan.textContent = categoryCounts[filter.dataset.category] || 0;
          }
        });
      }
  
      // Filter news items based on search and category
      function filterItems() {
        const searchTerm = (searchInput.value || '').toLowerCase();
        const activeCategory = document.querySelector('.category-filter.active').dataset.category;
  
        newsItems.forEach(item => {
          const headline = (item.querySelector('.news-headline').textContent || '').toLowerCase();
          const content = (item.querySelector('.news-content').textContent || '').toLowerCase();
          const category = (item.dataset.category || '').toLowerCase();
  
          const matchesSearch = !searchTerm || 
            headline.includes(searchTerm) || 
            content.includes(searchTerm) || 
            category.includes(searchTerm);
  
          const matchesCategory = activeCategory === 'all' || category === activeCategory;
  
          // Set visibility using data attribute
          item.setAttribute('data-visible', (matchesSearch && matchesCategory).toString());
          // Update display style
          item.style.display = (matchesSearch && matchesCategory) ? '' : 'none';
        });
      }
  
      // Add event listener for search input with debounce
      let searchTimeout;
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterItems, 200);
      });
  
      // Add event listeners for category filters
      categoryFilters.forEach(filter => {
        filter.addEventListener('click', function(e) {
          e.preventDefault();
          // Remove active class from all filters
          categoryFilters.forEach(f => f.classList.remove('active'));
          // Add active class to clicked filter
          this.classList.add('active');
          filterItems();
        });
      });
  
      // Initialize counts once
      setInitialCategoryCounts();
    }
  
    // If DOM is already loaded, initialize immediately
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNewsPanel);
    } else {
      initNewsPanel();
    }
  })();