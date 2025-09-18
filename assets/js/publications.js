// Publications page JavaScript functions
document.addEventListener('DOMContentLoaded', function() {
    // Ensure functions are available globally
    window.toggleCitation = toggleCitation;
    window.copyBibtex = copyBibtex;
  });
  
  function toggleCitation(id, button) {
    var citation = document.getElementById(id);
    var buttonText = button.querySelector('.citation-button-text');
    if (citation.style.display === "none" || citation.style.display === "") {
      citation.style.display = "block";
      buttonText.textContent = "Hide Citation";
    } else {
      citation.style.display = "none";
      buttonText.textContent = "Citation";
    }
  }
  
  function copyBibtex(id) {
    var bibtex = document.getElementById('bibtex-' + id);
    var textArea = document.createElement("textarea");
    textArea.value = formatBibtex(bibtex.textContent);
    document.body.appendChild(textArea);
    textArea.select();
    
    // Use modern clipboard API if available, fallback to deprecated method
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(formatBibtex(bibtex.textContent)).then(function() {
        showCopyFeedback();
      });
    } else {
      document.execCommand("Copy");
      showCopyFeedback();
    }
    
    textArea.remove();
    
    function showCopyFeedback() {
      // Show feedback
      var button = event.target.closest('button');
      var originalText = button.innerHTML;
      button.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copied!';
      button.style.background = '#28a745';
      
      setTimeout(function() {
        button.innerHTML = originalText;
        button.style.background = '';
      }, 2000);
    }
  }
  
  function formatBibtex(text) {
    text = text.trim();
    text = text.replace(/,\s+(\w+)\s+=\s+/g, ",\n  $1 = ");
    text = text.replace(/}$/, "\n}");
    
    return text;
  }