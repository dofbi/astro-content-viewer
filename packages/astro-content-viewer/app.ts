import { defineToolbarApp } from 'astro/toolbar';
import '@andypf/json-viewer';

export default defineToolbarApp({
  init(canvas, app, server) {
    const container = document.createElement('astro-dev-toolbar-window');
    
    const style = document.createElement('style');
    style.textContent = `
      .cv-container { padding: 12px; font-family: system-ui, sans-serif; min-width: 400px; max-height: 500px; overflow-y: auto; }
      .cv-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #fff; }
      .cv-list { list-style: none; padding: 0; margin: 0; }
      .cv-item { 
        padding: 8px 12px; 
        margin: 4px 0; 
        background: rgba(255,255,255,0.1); 
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s;
        color: #fff;
      }
      .cv-item:hover { background: rgba(255,255,255,0.2); }
      .cv-entries { margin-top: 12px; }
      .cv-entry { 
        padding: 6px 8px; 
        margin: 2px 0; 
        background: rgba(255,255,255,0.05); 
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: #fff;
      }
      .cv-entry:hover { background: rgba(255,255,255,0.1); }
      .cv-back { 
        padding: 6px 12px; 
        background: rgba(138,75,226,0.8); 
        border: none; 
        border-radius: 4px; 
        color: #fff; 
        cursor: pointer;
        margin-bottom: 12px;
        margin-right: 8px;
      }
      .cv-back:hover { background: rgba(138,75,226,1); }
      .cv-loading { color: #888; font-style: italic; }
      .cv-error { color: #ff6b6b; }
      .cv-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
      .cv-tab { 
        padding: 6px 16px; 
        background: rgba(255,255,255,0.1); 
        border: none; 
        border-radius: 4px 4px 0 0; 
        color: #aaa; 
        cursor: pointer;
        font-size: 12px;
      }
      .cv-tab.active { background: rgba(138,75,226,0.8); color: #fff; }
      .cv-tab-content { background: rgba(0,0,0,0.2); border-radius: 0 4px 4px 4px; padding: 12px; }
      .cv-schema-item { 
        display: flex; 
        justify-content: space-between; 
        padding: 6px 8px; 
        background: rgba(255,255,255,0.05); 
        border-radius: 4px; 
        margin: 4px 0;
        font-size: 12px;
      }
      .cv-schema-key { color: #7cc844; font-weight: 500; }
      .cv-schema-type { color: #e4b51c; }
      .cv-schema-examples { color: #888; font-size: 11px; margin-top: 2px; }
      .cv-json-container { max-height: 300px; overflow: auto; }
      andypf-json-viewer { display: block; }
    `;
    canvas.appendChild(style);
    canvas.appendChild(container);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'cv-container';
    container.appendChild(contentDiv);

    let currentCollection = '';
    let currentEntries: any[] = [];
    let currentSchema: Record<string, any> = {};

    function showLoading() {
      contentDiv.innerHTML = '<p class="cv-loading">Loading collections...</p>';
    }

    function showCollections(collections: string[]) {
      contentDiv.innerHTML = `
        <div class="cv-title">Content Collections</div>
        ${collections.length === 0 
          ? '<p class="cv-loading">No collections found</p>'
          : `<ul class="cv-list">${collections.map(c => 
              `<li class="cv-item" data-collection="${c}">${c}</li>`
            ).join('')}</ul>`
        }
      `;

      contentDiv.querySelectorAll('.cv-item').forEach(item => {
        item.addEventListener('click', () => {
          const collection = (item as HTMLElement).dataset.collection;
          if (collection) {
            showCollectionLoading(collection);
            server.send('content-viewer:get-collection-entries', { collection });
          }
        });
      });
    }

    function showCollectionLoading(name: string) {
      currentCollection = name;
      contentDiv.innerHTML = `
        <button class="cv-back">← Back</button>
        <div class="cv-title">${name}</div>
        <p class="cv-loading">Loading entries...</p>
      `;
      setupBackButton();
    }

    function showEntries(collection: string, entries: any[], schema: Record<string, any>) {
      currentCollection = collection;
      currentEntries = entries;
      currentSchema = schema;

      contentDiv.innerHTML = `
        <button class="cv-back">← Collections</button>
        <div class="cv-title">${collection} (${entries.length} entries)</div>
        <div class="cv-tabs">
          <button class="cv-tab active" data-tab="entries">Entries</button>
          <button class="cv-tab" data-tab="schema">Schema</button>
        </div>
        <div class="cv-tab-content" id="tab-content"></div>
      `;
      
      setupBackButton();
      setupTabs();
      showEntriesTab();
    }

    function setupTabs() {
      contentDiv.querySelectorAll('.cv-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          contentDiv.querySelectorAll('.cv-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          const tabName = (tab as HTMLElement).dataset.tab;
          if (tabName === 'entries') {
            showEntriesTab();
          } else if (tabName === 'schema') {
            showSchemaTab();
          }
        });
      });
    }

    function showEntriesTab() {
      const tabContent = contentDiv.querySelector('#tab-content');
      if (!tabContent) return;

      tabContent.innerHTML = `
        <div class="cv-entries">
          ${currentEntries.length === 0 
            ? '<p class="cv-loading">No entries</p>'
            : currentEntries.map((e, i) => `
                <div class="cv-entry" data-entry-index="${i}">
                  <strong>${e.id}</strong>
                  ${e.data?.title ? ` - ${e.data.title}` : ''}
                </div>
              `).join('')
          }
        </div>
      `;

      tabContent.querySelectorAll('.cv-entry').forEach(entry => {
        entry.addEventListener('click', () => {
          const index = parseInt((entry as HTMLElement).dataset.entryIndex || '0');
          showEntryDetail(currentEntries[index]);
        });
      });
    }

    function showSchemaTab() {
      const tabContent = contentDiv.querySelector('#tab-content');
      if (!tabContent) return;

      const schemaEntries = Object.entries(currentSchema);
      
      if (schemaEntries.length === 0) {
        tabContent.innerHTML = '<p class="cv-loading">No schema detected</p>';
        return;
      }

      tabContent.innerHTML = `
        <div class="cv-schema">
          ${schemaEntries.map(([key, info]) => `
            <div class="cv-schema-item">
              <span class="cv-schema-key">${key}</span>
              <span class="cv-schema-type">${(info as any).type}</span>
            </div>
            ${(info as any).examples?.length > 0 ? `
              <div class="cv-schema-examples">
                Examples: ${(info as any).examples.slice(0, 2).map((ex: any) => 
                  typeof ex === 'string' ? `"${ex.slice(0, 30)}${ex.length > 30 ? '...' : ''}"` : String(ex)
                ).join(', ')}
              </div>
            ` : ''}
          `).join('')}
        </div>
      `;
    }

    function showEntryDetail(entry: any) {
      contentDiv.innerHTML = `
        <button class="cv-back" data-back-to="entries">← ${currentCollection}</button>
        <div class="cv-title">${entry.id}</div>
        <div class="cv-tabs">
          <button class="cv-tab active" data-tab="data">Data (JSON)</button>
          <button class="cv-tab" data-tab="raw">Raw</button>
        </div>
        <div class="cv-tab-content" id="entry-tab-content"></div>
      `;
      
      setupEntryBackButton();
      setupEntryTabs(entry);
      showDataTab(entry);
    }

    function setupEntryBackButton() {
      const backBtn = contentDiv.querySelector('.cv-back[data-back-to="entries"]');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          showEntries(currentCollection, currentEntries, currentSchema);
        });
      }
    }

    function setupEntryTabs(entry: any) {
      contentDiv.querySelectorAll('.cv-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          contentDiv.querySelectorAll('.cv-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          const tabName = (tab as HTMLElement).dataset.tab;
          if (tabName === 'data') {
            showDataTab(entry);
          } else if (tabName === 'raw') {
            showRawTab(entry);
          }
        });
      });
    }

    function showDataTab(entry: any) {
      const tabContent = contentDiv.querySelector('#entry-tab-content');
      if (!tabContent) return;

      tabContent.innerHTML = '<div class="cv-json-container" id="json-container"></div>';
      
      const jsonContainer = tabContent.querySelector('#json-container');
      if (jsonContainer) {
        const jsonViewer = document.createElement('andypf-json-viewer');
        jsonViewer.setAttribute('theme', 'monokai');
        jsonViewer.setAttribute('expanded', '2');
        jsonViewer.setAttribute('show-data-types', 'true');
        jsonViewer.setAttribute('show-copy', 'true');
        jsonViewer.setAttribute('show-size', 'true');
        (jsonViewer as any).data = entry.data;
        jsonContainer.appendChild(jsonViewer);
      }
    }

    function showRawTab(entry: any) {
      const tabContent = contentDiv.querySelector('#entry-tab-content');
      if (!tabContent) return;

      tabContent.innerHTML = `
        <pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; overflow: auto; max-height: 300px; font-size: 11px; color: #ddd;">
${JSON.stringify(entry.data, null, 2)}
        </pre>
      `;
    }

    function setupBackButton() {
      const backBtn = contentDiv.querySelector('.cv-back');
      if (backBtn && !(backBtn as HTMLElement).dataset.backTo) {
        backBtn.addEventListener('click', () => {
          showLoading();
          server.send('content-viewer:get-collections', {});
        });
      }
    }

    server.on('content-viewer:collections-data', (data: any) => {
      if (data.error) {
        contentDiv.innerHTML = `<p class="cv-error">Error: ${data.error}</p>`;
      } else {
        showCollections(data.collections || []);
      }
    });

    server.on('content-viewer:collection-entries', (data: any) => {
      if (data.error) {
        contentDiv.innerHTML = `<p class="cv-error">Error: ${data.error}</p>`;
      } else {
        showEntries(data.collection, data.entries || [], data.schema || {});
      }
    });

    showLoading();
    server.send('content-viewer:get-collections', {});
  },
});
