<template>
  <TheContent class="container">
    <main class="data-model-page">
      <div class="header-row">
        <h1>Data Model — {{ selectedModelLabel }}</h1>
        <div class="model-select">
          <label for="modelSelect">Model</label>
          <select id="modelSelect" v-model="selectedModelId">
            <option v-for="m in AVAILABLE_DATA_MODELS" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
          <span v-if="activeTab === 'frontend' ? loadingModel : loadingBackendModel">Loading…</span>
        </div>
      </div>

      <div class="tabs-row" role="tablist" aria-label="Data model source tabs">
        <button
          type="button"
          :class="['tab-button', { active: activeTab === 'frontend' }]"
          role="tab"
          :aria-selected="activeTab === 'frontend'"
          @click="activeTab = 'frontend'"
        >
          DATA MODEL
        </button>
        <button
          type="button"
          :class="['tab-button', { active: activeTab === 'backend' }]"
          role="tab"
          :aria-selected="activeTab === 'backend'"
          @click="activeTab = 'backend'"
        >
          DATA MODEL BACKEND
        </button>
      </div>

      <div class="search-row">
        <input
          v-model="q"
          type="search"
          placeholder="Search object path, field name, label, component, description..."
          aria-label="Search data model"
        />
        <button @click="q = ''">Clear</button>
      </div>

      <div class="panel">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="col-objectPath">Object Path</th>
                <th class="col-fieldName">Field Name</th>
                <th class="col-label">Label</th>
                <th class="col-component">Component / Type</th>
                <th class="col-description">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="row.id">
                <td class="col-objectPath">{{ row.objectPath }}</td>
                <td class="col-fieldName">{{ row.fieldName }}</td>
                <td class="col-label">{{ row.label }}</td>
                <td class="col-component">{{ row.component ?? row.type ?? '' }}</td>
                <td class="col-description">{{ row.description ?? '' }}</td>
              </tr>
              <tr v-if="filteredRows.length === 0">
                <td colspan="5">
                  {{
                    activeTab === 'backend' && !loadingBackendModel
                      ? 'No backend specification available for this model.'
                      : 'No results'
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </TheContent>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import TheContent from '@/components/generics/TheContent.vue';
import { AVAILABLE_DATA_MODELS, extractDataModel } from '@/frameworks/availableDataModels';

interface Row {
  id: string;
  objectPath: string;
  fieldName: string;
  label?: string;
  component?: string;
  type?: string;
  description?: string;
}

const q = ref('');
const activeTab = ref<'frontend' | 'backend'>('frontend');

const selectedModelId = ref<string>(AVAILABLE_DATA_MODELS[0]?.id ?? '');
const selectedModelLabel = ref<string>(AVAILABLE_DATA_MODELS[0]?.label ?? 'Data Model');
const selectedDataModel = ref<any[]>([]);
const selectedBackendSchema = ref<Record<string, unknown> | null>(null);
const loadingModel = ref(false);
const loadingBackendModel = ref(false);
let latestLoadToken = 0;

async function loadModel(id: string) {
  const loadToken = ++latestLoadToken;
  const entry = AVAILABLE_DATA_MODELS.find((e) => e.id === id);
  if (!entry) {
    if (loadToken === latestLoadToken) {
      selectedDataModel.value = [];
      selectedModelLabel.value = 'Data Model';
    }
    return;
  }
  if (loadToken === latestLoadToken) {
    selectedModelLabel.value = entry.label;
    loadingModel.value = true;
  }
  try {
    if (entry.dataModel) {
      if (loadToken === latestLoadToken) selectedDataModel.value = entry.dataModel as any[];
    } else if (entry.loader) {
      const mod = await entry.loader();
      const dm = await extractDataModel(mod);
      if (loadToken === latestLoadToken) selectedDataModel.value = dm ?? [];
    } else {
      if (loadToken === latestLoadToken) selectedDataModel.value = [];
    }
  } catch (err) {
    // swallow errors and present empty model
    if (loadToken === latestLoadToken) selectedDataModel.value = [];
  } finally {
    if (loadToken === latestLoadToken) loadingModel.value = false;
  }
}

async function loadBackendModel(id: string): Promise<void> {
  loadingBackendModel.value = true;
  try {
    const resolvedSchemaResponse = await fetch(`/specifications/frameworks/${id}/resolved-schema`);
    if (resolvedSchemaResponse.ok) {
      const resolvedSchema = (await resolvedSchemaResponse.json()) as Record<string, unknown>;
      selectedBackendSchema.value = normalizeSchemaPayload(resolvedSchema);
      return;
    }

    const specificationResponse = await fetch(`/specifications/frameworks/${id}`);
    if (!specificationResponse.ok) {
      selectedBackendSchema.value = null;
      return;
    }
    const specification = (await specificationResponse.json()) as Record<string, unknown>;
    selectedBackendSchema.value = normalizeSchemaPayload(specification);
  } catch (_error) {
    selectedBackendSchema.value = null;
  } finally {
    loadingBackendModel.value = false;
  }
}

function normalizeSchemaPayload(payload: Record<string, unknown>): Record<string, unknown> | null {
  const candidate = payload.schema;
  if (candidate && typeof candidate === 'object') {
    return candidate as Record<string, unknown>;
  }

  const payloadValues = Object.values(payload);
  const containsSchemaLeafValues = payloadValues.some((value) => typeof value === 'string' || typeof value === 'object');
  if (containsSchemaLeafValues) {
    return payload;
  }

  return null;
}

onMounted(() => {
  if (selectedModelId.value) {
    void loadModel(selectedModelId.value);
    void loadBackendModel(selectedModelId.value);
  }
});

watch(selectedModelId, (v) => {
  void loadModel(v);
  void loadBackendModel(v);
});

const frontendRows = computed<Row[]>(() => {
  const out: Row[] = [];
  (selectedDataModel.value as any[]).forEach((category: any) => {
    const catName = category.name ?? category.label ?? 'category';
    (category.subcategories || []).forEach((subcat: any) => {
      const subName = subcat.name ?? subcat.label ?? 'subcategory';
      (subcat.fields || []).forEach((field: any) => {
        out.push({
          id: `${catName}.${subName}.${field.name}`,
          objectPath: `${catName}.${subName}`,
          fieldName: field.name,
          label: field.label,
          component: field.component,
          description: field.description,
        });
      });
    });
  });
  return out;
});

function flattenBackendSchemaNode(schemaNode: unknown, currentPath: string, rows: Row[]): void {
  if (!schemaNode || typeof schemaNode !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(schemaNode)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;

    if (typeof value === 'string') {
      rows.push({
        id: nextPath,
        objectPath: currentPath,
        fieldName: key,
        type: value,
      });
      continue;
    }

    flattenBackendSchemaNode(value, nextPath, rows);
  }
}

const backendRows = computed<Row[]>(() => {
  if (!selectedBackendSchema.value) {
    return [];
  }

  const out: Row[] = [];
  flattenBackendSchemaNode(selectedBackendSchema.value, '', out);
  return out;
});

const rows = computed<Row[]>(() => {
  return activeTab.value === 'frontend' ? frontendRows.value : backendRows.value;
});

const filteredRows = computed(() => {
  const term = q.value.trim().toLowerCase();
  if (!term) return rows.value;
  return rows.value.filter((r) => {
    return (
      String(r.objectPath).toLowerCase().includes(term) ||
      String(r.fieldName).toLowerCase().includes(term) ||
      String(r.label ?? '').toLowerCase().includes(term) ||
      String(r.component ?? '').toLowerCase().includes(term) ||
      String(r.type ?? '').toLowerCase().includes(term) ||
      String(r.description ?? '').toLowerCase().includes(term)
    );
  });
});
</script>

<style scoped>
.container > main.data-model-page {
  max-width: 1100px;
  margin: 1.5rem auto;
}
.data-model-page {
  padding: 1rem;
}
.search-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.tabs-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.tab-button {
  border: 1px solid var(--input-separator, #e6e6e6);
  background: var(--default-neutral-white, #fff);
  color: inherit;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  border-radius: 0.2rem;
}

.tab-button.active {
  background: var(--table-background-hover-color-light, #f4f6f8);
  font-weight: 600;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}
.model-select { display:flex; align-items:center; gap:0.5rem; }
.model-select label { font-size:0.9rem; }
.table-wrap {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed; /* use fixed layout so column widths are respected and rows wrap */
}
th, td {
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid var(--input-separator, #e6e6e6);
  vertical-align: top;
}
/* Column sizing: percentages chosen to match typical content lengths */
.col-objectPath { width: 18%; min-width: 120px; }
.col-fieldName { width: 12%; min-width: 100px; }
.col-label { width: 20%; min-width: 140px; }
.col-component { width: 15%; min-width: 120px; }
.col-description { width: 35%; min-width: 200px; }

/* Allow long text to wrap and break to fit the column */
.col-description, .col-label, .col-objectPath, .col-component, .col-fieldName {
  word-break: break-word;
  white-space: normal;
}

/* Improve readability on small screens */
@media (max-width: 900px) {
  .col-objectPath, .col-fieldName, .col-component { display: none; }
  table { table-layout: auto; }
}
</style>
