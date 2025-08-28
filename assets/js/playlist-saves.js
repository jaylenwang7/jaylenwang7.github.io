document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded. Starting playlist script.");

  function formatDelta(n) {
    if (typeof n !== 'number' || isNaN(n)) return '';
    return (n > 0 ? '+' : '') + n;
  }

  function renderFromJson(data) {
    console.log("Attempting to render from JSON data:", data);
    try {
      const saves = data && typeof data.saves === 'number' ? data.saves : null;
      const lastUpdated = data && data.last_updated ? data.last_updated : '';
      const history = Array.isArray(data && data.history) ? data.history : [];

      if (saves !== null) {
        document.getElementById('playlist-saves').textContent = ' ' + saves;
      }
      if (lastUpdated) {
        document.getElementById('last-updated').textContent = lastUpdated;
      }

      if (history.length >= 2) {
        document.getElementById('deltas-wrapper').style.display = 'inline';
        const delta1d = (history[history.length - 1].saves || 0) - (history[history.length - 2].saves || 0);
        const delta7d = (history[history.length - 1].saves || 0) - (history[0].saves || 0);

        document.getElementById('delta-1d').textContent = formatDelta(delta1d);
        document.getElementById('delta-7d').textContent = formatDelta(delta7d);
      }
      console.log("Successfully rendered from JSON.");
    } catch (e) {
      console.error("Error inside renderFromJson:", e);
    }
  }

  function renderFromYaml(text) { // fallback when JSON isn't available yet
    console.log("Attempting to render from YAML text:", text);
    try {
      const lines = text.split('\n');
      const saves = lines[0].split(':')[1].trim();
      const lastUpdated = lines[2].split(': ')[1].trim().replace(/^'|'$/g, '');
      document.getElementById('playlist-saves').textContent = ' ' + saves;
      document.getElementById('last-updated').textContent = lastUpdated;
      console.log("Successfully rendered from YAML.");
    } catch (e) {
      console.error("Error inside renderFromYaml:", e);
    }
  }

  console.log("Fetching JSON data from /assets/data/playlist_saves.json...");
  fetch('/assets/data/playlist_saves.json')
    .then(function(r) {
      console.log("JSON fetch response:", r);
      if (!r.ok) {
        throw new Error('JSON fetch failed with status: ' + r.status);
      }
      return r.json();
    })
    .then(function(data) {
        console.log("Successfully parsed JSON data.");
        renderFromJson(data);
    })
    .catch(function(jsonError) {
      console.error("Failed to load or parse JSON:", jsonError);
      console.log("Falling back to YAML data...");
      fetch('/assets/data/playlist_saves.yml')
        .then(function(r) {
            console.log("YAML fetch response:", r);
            if (!r.ok) {
                throw new Error('YAML fetch failed with status: ' + r.status);
            }
            return r.text();
        })
        .then(function(text) {
            console.log("Successfully fetched YAML text.");
            renderFromYaml(text);
        })
        .catch(function(yamlError) {
            console.error("Failed to load YAML as a fallback:", yamlError);
        });
    });
});
