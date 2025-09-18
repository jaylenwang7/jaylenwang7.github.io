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
  
  function copyBibtex(id, button) {
    var bibtex = document.getElementById('bibtex-' + id);
    var textArea = document.createElement("textarea");
    textArea.value = formatBibtex(bibtex.textContent);
    document.body.appendChild(textArea);
    textArea.select();
    
    // Use modern clipboard API if available, fallback to deprecated method
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(formatBibtex(bibtex.textContent)).then(function() {
        showCopyFeedback(button);
      });
    } else {
      document.execCommand("Copy");
      showCopyFeedback(button);
    }
    
    textArea.remove();
    
    function showCopyFeedback(clickedButton) {
      // Show feedback
      var btn = clickedButton || document.activeElement;
      var originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copied!';
      btn.style.background = '#28a745';
      
      setTimeout(function() {
        btn.innerHTML = originalText;
        btn.style.background = '';
      }, 2000);
    }
  }
  
  function formatBibtex(text) {
    text = text.trim();
    text = text.replace(/,\s+(\w+)\s+=\s+/g, ",\n  $1 = ");
    text = text.replace(/}$/m, "\n}");
    
    return text;
  }