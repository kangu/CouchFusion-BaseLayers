<template>
  <div class="node-panel" :style="{ marginLeft: depth * 16 + 'px' }">
    <div v-if="node.type === 'component'" class="node-panel__header">
      <div class="node-panel__header-main">
        <div class="node-panel__header-text">
          <strong>{{ componentDef?.label || node.component }}</strong>
          <span v-if="componentDef?.description" class="node-panel__description">{{ componentDef.description }}</span>
        </div>
        <div class="node-panel__header-actions">
          <button
            type="button"
            class="node-panel__toggle"
            :data-state="collapsedNodes[node.uid] ? 'collapsed' : 'expanded'"
            @click="toggleNode(node.uid)"
          >
            {{ collapsedNodes[node.uid] ? 'Expand' : 'Collapse' }}
          </button>
          <button class="node-panel__remove" type="button" @click="onRemove(node.uid)">
            Remove
          </button>
        </div>
      </div>
    </div>

    <div v-if="node.type === 'component'" class="node-panel__body" v-show="!collapsedNodes[node.uid]">
      <div v-if="componentDef?.props?.length" class="node-panel__props">
        <label v-for="prop in componentDef.props" :key="prop.key" class="node-panel__field" :class="{'is-row': prop.type === 'boolean'}">
          <span>{{ prop.label }}</span>
          <template v-if="prop.type === 'textarea'">
            <textarea
              v-model="propDraft[prop.key]"
              :placeholder="prop.placeholder"
              rows="3"
              @input="() => schedulePropUpdate(prop.key, propDraft[prop.key], prop.type)"
              @blur="() => flushPropUpdate(prop.key, propDraft[prop.key], prop.type)"
            />
          </template>
          <template v-else-if="prop.type === 'boolean'">
            <span class="node-panel__checkbox">
              <input
                type="checkbox"
                class="node-panel__checkbox-input"
                :checked="Boolean(propDraft[prop.key])"
                @change="(event: Event) => applyProp(prop.key, (event.target as HTMLInputElement).checked, prop.type)"
              />
              <span class="node-panel__checkbox-box" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 10.5L8.5 14L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </span>
          </template>
          <template v-else-if="prop.type === 'select'">
            <select
              v-model="propDraft[prop.key]"
              @change="() => applyProp(prop.key, propDraft[prop.key], prop.type)"
            >
              <option disabled value="">Select</option>
              <option v-for="option in prop.options || []" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </template>
          <template v-else-if="prop.type === 'json'">
            <textarea
              v-model="propDraft[prop.key]"
              class="font-mono"
              rows="6"
              @change="() => applyProp(prop.key, propDraft[prop.key], prop.type)"
              @blur="() => applyProp(prop.key, propDraft[prop.key], prop.type)"
            />
            <small v-if="jsonErrors[prop.key]" class="node-panel__error">{{ jsonErrors[prop.key] }}</small>
          </template>
          <template v-else-if="prop.type === 'jsonobject' && (prop.fields?.length)">
            <div class="node-panel__object">
              <label
                v-for="field in prop.fields || []"
                :key="`${prop.key}-${field.key}`"
                class="node-panel__field node-panel__field--nested"
              >
                <span>{{ field.label }}</span>
                    <template v-if="field.type === 'textarea'">
                      <textarea
                        v-model="propDraft[prop.key][field.key]"
                        rows="3"
                        @input="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key], { debounce: true })"
                        @change="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key])"
                        @blur="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key])"
                      />
                    </template>
                    <template v-else-if="field.type === 'boolean'">
                  <span class="node-panel__checkbox">
                    <input
                      type="checkbox"
                      class="node-panel__checkbox-input"
                      :checked="Boolean(propDraft[prop.key][field.key])"
                      @change="(event: Event) =>
                        handleObjectFieldChange(
                          prop.key,
                          field,
                          (event.target as HTMLInputElement).checked
                        )"
                    />
                    <span class="node-panel__checkbox-box" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 10.5L8.5 14L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span>
                  </span>
                </template>
                <template v-else-if="field.type === 'number'">
                  <input
                    v-model.number="propDraft[prop.key][field.key]"
                    type="number"
                    @input="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key], { debounce: true })"
                    @change="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key])"
                    @blur="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key])"
                  />
                </template>
                <template v-else-if="field.type === 'select'">
                  <select
                    v-model="propDraft[prop.key][field.key]"
                    @change="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key])"
                  >
                    <option disabled value="">Select</option>
                    <option v-for="option in field.options || []" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </template>
                <template v-else-if="field.ui?.component">
                  <component
                    :is="field.ui.component"
                    :model-value="propDraft[prop.key][field.key]"
                    :prop-definition="field"
                    :field-context="{ propKey: prop.key }"
                    @update:modelValue="(value: unknown) =>
                      handleObjectFieldChange(prop.key, field, value, { debounce: true })"
                  />
                </template>
                <template v-else>
                  <input
                    v-model="propDraft[prop.key][field.key]"
                    type="text"
                    @input="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key], { debounce: true })"
                    @change="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key])"
                    @blur="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key])"
                  />
                </template>
                <small
                  v-if="objectFieldErrors[prop.key]?.[field.key]"
                  class="node-panel__error"
                >
                  {{ objectFieldErrors[prop.key]?.[field.key] }}
                </small>
              </label>
            </div>
          </template>
          <template v-else-if="prop.type === 'jsonobject'">
            <textarea
              v-model="propDraft[prop.key]"
              class="font-mono"
              rows="6"
              @change="() => applyProp(prop.key, propDraft[prop.key], 'json')"
              @blur="() => applyProp(prop.key, propDraft[prop.key], 'json')"
            />
            <small v-if="jsonErrors[prop.key]" class="node-panel__error">{{ jsonErrors[prop.key] }}</small>
          </template>
          <template v-else-if="prop.type === 'jsonarray'">
            <div class="node-panel__array" :data-collapsed="collapsedArrays[prop.key]">
              <div class="node-panel__array-header">
                <button
                  type="button"
                  class="node-panel__array-toggle"
                  :data-state="collapsedArrays[prop.key] ? 'collapsed' : 'expanded'"
                  @click="toggleArray(prop.key)"
                >
                  {{ collapsedArrays[prop.key] ? 'Expand' : 'Collapse' }} ({{ propDraft[prop.key]?.length || 0 }})
                </button>
                <button
                  type="button"
                  class="node-panel__array-add"
                  @click="openInsertDialog(prop)"
                >
                  <span class="node-panel__array-add-icon" aria-hidden="true">+</span>
<!--                  <span>Add item</span>-->
                </button>
              </div>
              <div
                v-for="(item, index) in propDraft[prop.key]"
                :key="`${prop.key}-${index}`"
                class="node-panel__array-item"
                :class="{
                  'node-panel__array-item--drag-over':
                    dragOverArrayItem?.propKey === prop.key && dragOverArrayItem.index === index
                }"
                draggable="true"
                @dragstart.stop="(event) => handleArrayItemDragStart(prop.key, index, 'jsonarray', event)"
                @dragenter.stop.prevent="() => handleArrayItemDragEnter(prop.key, index)"
                @dragover.stop.prevent="() => handleArrayItemDragEnter(prop.key, index)"
                @dragleave.stop="handleArrayItemDragLeave"
                @drop.stop.prevent="() => handleArrayItemDrop(prop.key, index, 'jsonarray')"
                @dragend.stop="handleArrayItemDragEnd"
                v-show="!collapsedArrays[prop.key]"
              >
                <div class="node-panel__array-fields">
                  <label
                    v-for="field in prop.items || []"
                    :key="field.key"
                    class="node-panel__field node-panel__field--nested"
                  >
                    <span>{{ field.label }}</span>
                    <template v-if="field.type === 'textarea'">
                      <textarea
                        v-model="item[field.key]"
                        rows="3"
                        @input="() =>
                          handleArrayItemFieldChange(prop.key, index, field, item[field.key], {
                            debounce: true
                          })"
                        @change="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                        @blur="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                      />
                    </template>
                    <template v-else-if="field.type === 'boolean'">
                      <span class="node-panel__checkbox">
                        <input
                          type="checkbox"
                          class="node-panel__checkbox-input"
                          :checked="Boolean(item[field.key])"
                          @change="(event: Event) => handleArrayItemFieldChange(prop.key, index, field, (event.target as HTMLInputElement).checked)"
                        />
                        <span class="node-panel__checkbox-box" aria-hidden="true">
                          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 10.5L8.5 14L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </span>
                      </span>
                    </template>
                    <template v-else-if="field.type === 'number'">
                      <input
                        v-model.number="item[field.key]"
                        type="number"
                        @input="() =>
                          handleArrayItemFieldChange(prop.key, index, field, item[field.key], {
                            debounce: true
                          })"
                        @change="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                        @blur="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                      />
                    </template>
                    <template v-else-if="field.ui?.component">
                      <component
                        :is="field.ui.component"
                        :model-value="item[field.key]"
                        :prop-definition="field"
                        :field-context="{ propKey: prop.key, arrayIndex: index }"
                        @update:modelValue="(value: unknown) =>
                          handleCustomArrayFieldUpdate(prop.key, index, field, value, {
                            debounce: true
                          })"
                      />
                    </template>
                    <template v-else-if="field.type === 'jsonarray'">
                      <div
                        class="node-panel__array node-panel__array--nested"
                        :data-collapsed="isNestedArrayCollapsed(prop.key, index, field.key)"
                      >
                        <div class="node-panel__array-header node-panel__array-header--nested">
                          <button
                            type="button"
                            class="node-panel__array-toggle"
                            :data-state="isNestedArrayCollapsed(prop.key, index, field.key) ? 'collapsed' : 'expanded'"
                            @click="toggleNestedArray(prop.key, index, field.key)"
                          >
                            {{ isNestedArrayCollapsed(prop.key, index, field.key) ? 'Expand' : 'Collapse' }}
                            ({{ getNestedArrayItems(prop.key, index, field).length }})
                          </button>
                          <button
                            type="button"
                            class="node-panel__array-add"
                            @click="addNestedArrayItem(prop.key, index, field)"
                          >
                            <span class="node-panel__array-add-icon" aria-hidden="true">+</span>
                          </button>
                        </div>
                        <div
                          v-for="(nestedItem, nestedIndex) in getNestedArrayItems(prop.key, index, field)"
                          :key="`${prop.key}-${index}-${field.key}-${nestedIndex}`"
                          class="node-panel__array-item node-panel__array-item--nested"
                          v-show="!isNestedArrayCollapsed(prop.key, index, field.key)"
                        >
                          <div class="node-panel__array-fields node-panel__array-fields--nested">
                            <label
                              v-for="nestedField in field.items || []"
                              :key="`${field.key}-${nestedField.key}-${nestedIndex}`"
                              class="node-panel__field node-panel__field--nested"
                            >
                              <span>{{ nestedField.label }}</span>
                              <template v-if="nestedField.type === 'textarea'">
                                <textarea
                                  v-model="nestedItem[nestedField.key]"
                                  rows="3"
                                  @input="() =>
                                    updateNestedArrayItemField(
                                      prop.key,
                                      index,
                                      field,
                                      nestedIndex,
                                      nestedField,
                                      nestedItem[nestedField.key],
                                      { debounce: true }
                                    )
                                  "
                                  @change="() =>
                                    updateNestedArrayItemField(
                                      prop.key,
                                      index,
                                      field,
                                      nestedIndex,
                                      nestedField,
                                      nestedItem[nestedField.key]
                                    )
                                  "
                                  @blur="() =>
                                    updateNestedArrayItemField(
                                      prop.key,
                                      index,
                                      field,
                                      nestedIndex,
                                      nestedField,
                                      nestedItem[nestedField.key]
                                    )
                                  "
                                />
                              </template>
                              <template v-else-if="nestedField.type === 'boolean'">
                                <span class="node-panel__checkbox">
                                  <input
                                    type="checkbox"
                                    class="node-panel__checkbox-input"
                                    :checked="Boolean(nestedItem[nestedField.key])"
                                    @change="(event: Event) =>
                                      updateNestedArrayItemField(
                                        prop.key,
                                        index,
                                        field,
                                        nestedIndex,
                                        nestedField,
                                        (event.target as HTMLInputElement).checked
                                      )
                                    "
                                  />
                                  <span class="node-panel__checkbox-box" aria-hidden="true">
                                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M5 10.5L8.5 14L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                  </span>
                                </span>
                              </template>
                              <template v-else-if="nestedField.type === 'number'">
                                <input
                                  v-model.number="nestedItem[nestedField.key]"
                                  type="number"
                                  @input="() =>
                                    updateNestedArrayItemField(
                                      prop.key,
                                      index,
                                      field,
                                      nestedIndex,
                                      nestedField,
                                      nestedItem[nestedField.key],
                                      { debounce: true }
                                    )
                                  "
                                  @change="() =>
                                    updateNestedArrayItemField(
                                      prop.key,
                                      index,
                                      field,
                                      nestedIndex,
                                      nestedField,
                                      nestedItem[nestedField.key]
                                    )
                                  "
                                  @blur="() =>
                                    updateNestedArrayItemField(
                                      prop.key,
                                      index,
                                      field,
                                      nestedIndex,
                                      nestedField,
                                      nestedItem[nestedField.key]
                                    )
                                  "
                                />
                              </template>
                              <template v-else-if="nestedField.ui?.component">
                                <component
                                  :is="nestedField.ui.component"
                                  :model-value="nestedItem[nestedField.key]"
                                  :prop-definition="nestedField"
                                  :field-context="{
                                    propKey: prop.key,
                                    arrayIndex: index,
                                    nestedFieldKey: nestedField.key,
                                    nestedIndex
                                  }"
                                  @update:modelValue="(value: unknown) =>
                                    updateCustomNestedArrayItemField(
                                      prop.key,
                                      index,
                                      field,
                                      nestedIndex,
                                      nestedField,
                                      value,
                                      { debounce: true }
                                    )"
                                />
                              </template>
                              <template v-else>
                                <input
                                  v-model="nestedItem[nestedField.key]"
                                  type="text"
                                  @input="() =>
                                    updateNestedArrayItemField(
                                      prop.key,
                                      index,
                                      field,
                                      nestedIndex,
                                      nestedField,
                                      nestedItem[nestedField.key],
                                      { debounce: true }
                                    )
                                  "
                                  @change="() =>
                                    updateNestedArrayItemField(
                                      prop.key,
                                      index,
                                      field,
                                      nestedIndex,
                                      nestedField,
                                      nestedItem[nestedField.key]
                                    )
                                  "
                                  @blur="() =>
                                    updateNestedArrayItemField(
                                      prop.key,
                                      index,
                                      field,
                                      nestedIndex,
                                      nestedField,
                                      nestedItem[nestedField.key]
                                    )
                                  "
                                />
                              </template>
                            </label>
                          </div>
                          <button
                            type="button"
                            class="node-panel__array-remove"
                            @click="removeNestedArrayItem(prop.key, index, field, nestedIndex)"
                          >
                            Remove item
                          </button>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <input
                        v-model="item[field.key]"
                        type="text"
                        @input="() =>
                          handleArrayItemFieldChange(prop.key, index, field, item[field.key], {
                            debounce: true
                          })"
                        @change="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                        @blur="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                      />
                    </template>
                  </label>
                </div>
                <button
                  type="button"
                  class="node-panel__array-remove"
                  @click="removeArrayItem(prop.key, index)"
                >
                  Remove item
                </button>
              </div>
            </div>
          </template>
          <template v-else-if="prop.type === 'stringarray'">
            <div class="node-panel__array" :data-collapsed="collapsedArrays[prop.key]">
              <div class="node-panel__array-header">
                <button
                  type="button"
                  class="node-panel__array-toggle"
                  :data-state="collapsedArrays[prop.key] ? 'collapsed' : 'expanded'"
                  @click="toggleArray(prop.key)"
                >
                  {{ collapsedArrays[prop.key] ? 'Expand' : 'Collapse' }} ({{ propDraft[prop.key]?.length || 0 }})
                </button>
                <button
                  type="button"
                  class="node-panel__array-add"
                  @click="openInsertDialog(prop)"
                >
                  <span class="node-panel__array-add-icon" aria-hidden="true">+</span>
<!--                  <span>Add item</span>-->
                </button>
              </div>
              <div
                v-for="(value, index) in propDraft[prop.key]"
                :key="`${prop.key}-${index}`"
                class="node-panel__array-item"
                :class="{
                  'node-panel__array-item--drag-over':
                    dragOverArrayItem?.propKey === prop.key && dragOverArrayItem.index === index
                }"
                draggable="true"
                @dragstart.stop="(event) => handleArrayItemDragStart(prop.key, index, 'stringarray', event)"
                @dragenter.stop.prevent="() => handleArrayItemDragEnter(prop.key, index)"
                @dragover.stop.prevent="() => handleArrayItemDragEnter(prop.key, index)"
                @dragleave.stop="handleArrayItemDragLeave"
                @drop.stop.prevent="() => handleArrayItemDrop(prop.key, index, 'stringarray')"
                @dragend.stop="handleArrayItemDragEnd"
                v-show="!collapsedArrays[prop.key]"
              >
                <label class="node-panel__field">
                  <span>{{ prop.label }} {{ index + 1 }}</span>
                  <component
                    v-if="prop.ui?.component"
                    :is="prop.ui.component"
                    :model-value="propDraft[prop.key][index]"
                    :prop-definition="prop"
                    :field-context="{ propKey: prop.key, arrayIndex: index }"
                    @update:modelValue="(value: unknown) =>
                      handleStringArrayChange(prop.key, index, value, { debounce: true })"
                  />
                  <input
                    v-else
                    v-model="propDraft[prop.key][index]"
                    type="text"
                    @input="() =>
                      handleStringArrayChange(prop.key, index, propDraft[prop.key][index], {
                        debounce: true
                      })"
                    @change="() => handleStringArrayChange(prop.key, index, propDraft[prop.key][index])"
                    @blur="() => handleStringArrayChange(prop.key, index, propDraft[prop.key][index])"
                  />
                </label>
                <button
                  type="button"
                  class="node-panel__array-remove"
                  @click="removeStringArrayItem(prop.key, index)"
                >
                  Remove item
                </button>
              </div>
            </div>
          </template>
          <template v-else-if="prop.ui?.component">
            <component
              :is="prop.ui.component"
              :model-value="propDraft[prop.key]"
              :prop-definition="prop"
              :field-context="{ propKey: prop.key }"
              @update:modelValue="(value: unknown) => handleCustomPropUpdate(prop, value, { debounce: true })"
            />
          </template>
          <template v-else>
            <input
              v-model="propDraft[prop.key]"
              :placeholder="prop.placeholder"
              :type="prop.type === 'number' ? 'number' : 'text'"
              @input="() => schedulePropUpdate(prop.key, propDraft[prop.key], prop.type)"
              @blur="() => flushPropUpdate(prop.key, propDraft[prop.key], prop.type)"
            />
          </template>
          <small v-if="prop.description">{{ prop.description }}</small>
        </label>
      </div>

      <div v-if="extraPropEntries.length" class="node-panel__props">
        <label v-for="entry in extraPropEntries" :key="entry.key" class="node-panel__field">
          <span>{{ entry.key }}</span>
          <input
            v-model="extraPropsDraft[entry.key]"
            type="text"
            @input="() => schedulePropUpdate(entry.key, extraPropsDraft[entry.key], 'text')"
            @blur="() => flushPropUpdate(entry.key, extraPropsDraft[entry.key], 'text')"
          />
        </label>
      </div>

      <!-- New props are not enabled for the moment, keep it here for possible future use -->
<!--
      <form class="node-panel__new-prop" @submit.prevent="handleAddCustomProp">
        <div>
          <input v-model="newPropKey" placeholder="Prop key (e.g. theme)" />
        </div>
        <div>
          <input v-model="newPropValue" placeholder="Value" />
        </div>
        <button type="submit">Add prop</button>
      </form>
-->

      <div class="node-panel__margins">
        <div class="node-panel__margins-header">
          <h4>Margins</h4>
          <div class="node-panel__margins-actions">
            <button type="button" class="node-panel__margins-toggle" @click="showResponsiveMargins = !showResponsiveMargins">
              {{ showResponsiveMargins ? 'Hide responsive' : 'Responsive overrides' }}
            </button>
            <button
              type="button"
              class="node-panel__margins-reset"
              @click="resetMargins"
            >
              Reset
            </button>
          </div>
        </div>
        <div class="node-panel__margins-grid">
          <label
            v-for="side in marginSides"
            :key="`base-${side.key}`"
            class="node-panel__margin-field"
          >
            <span>{{ side.label }}</span>
            <select
              :value="marginDraft[side.key].base"
              @change="handleMarginChange(side.key, 'base', ($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="option in marginOptions"
                :key="`${side.key}-base-${option.value}`"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
        <Transition name="fade">
          <div v-if="showResponsiveMargins" class="node-panel__margins-responsive">
            <div
              v-for="breakpoint in responsiveBreakpoints"
              :key="breakpoint.key"
              class="node-panel__margins-row"
            >
              <div class="node-panel__margin-breakpoint">{{ breakpoint.label }}</div>
              <div class="node-panel__margins-grid node-panel__margins-grid--responsive">
                <label
                  v-for="side in marginSides"
                  :key="`${breakpoint.key}-${side.key}`"
                  class="node-panel__margin-field"
                >
                  <span>{{ side.short }}</span>
                  <select
                    :value="marginDraft[side.key][breakpoint.key]"
                    @change="handleMarginChange(side.key, breakpoint.key, ($event.target as HTMLSelectElement).value)"
                  >
                    <option
                      v-for="option in marginOptions"
                      :key="`${side.key}-${breakpoint.key}-${option.value}`"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <div v-if="componentDef?.allowChildren" class="node-panel__children">
        <div class="node-panel__children-actions">
          <select v-model="selectedChildComponent">
            <option disabled value="">Select component</option>
            <option
              v-for="option in componentOptions"
              :key="option.id"
              :value="option.id"
            >
              {{ option.label }}
            </option>
          </select>
          <button
            type="button"
            :disabled="!selectedChildComponent"
            @click="handleAddChildComponent"
          >
            Add child component
          </button>
          <button type="button" @click="onAddChildText(node.uid)">
            Add text child
          </button>
        </div>
        <p v-if="componentDef.childHint" class="node-panel__hint">{{ componentDef.childHint }}</p>
        <NodeEditor
          v-for="child in node.children"
          :key="child.uid"
          :node="child"
          :registry="registry"
          :component-options="componentOptions"
          :depth="depth + 1"
          :on-update-prop="onUpdateProp"
          :on-update-text="onUpdateText"
          :on-add-child-component="onAddChildComponent"
          :on-add-child-text="onAddChildText"
          :on-remove="onRemove"
        />
      </div>
    </div>

    <div v-else class="node-panel__text">
      <label class="node-panel__field">
        <span>Text value</span>
        <textarea
          v-model="textDraft"
          rows="2"
          @change="applyTextValue"
          @blur="applyTextValue"
        />
      </label>
      <button class="node-panel__remove" type="button" @click="onRemove(node.uid)">
        Remove
      </button>
    </div>
    <div v-if="insertDialog.key && insertDialog.type" class="node-panel__insert-dialog">
      <div class="node-panel__insert-backdrop" @click="closeInsertDialog"></div>
      <div class="node-panel__insert-content">
        <header class="node-panel__insert-header">
          <h3>Select insertion point</h3>
          <button type="button" class="node-panel__insert-close" @click="closeInsertDialog">×</button>
        </header>
        <p class="node-panel__insert-subtitle">
          Choose where to place the new {{ insertDialog.type === 'jsonarray' ? 'entry' : 'text item' }}.
        </p>
        <ul class="node-panel__insert-options">
          <li
            v-for="option in getInsertPositions()"
            :key="`${insertDialog.key}-${option.index}`"
          >
            <button type="button" @click="handleInsertAt(option.index)">
              <strong>Position {{ option.index + 1 }}</strong>
              <span>{{ option.preview }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from 'vue'
import type {
  BuilderNodeChild,
  BuilderResponsiveMargin,
  ComponentArrayItemField,
  ComponentDefinition,
  ComponentPropSchema,
  ComponentRegistry
} from '~/types/builder'

const isNestedArrayField = (
  field: ComponentArrayItemField
): field is Extract<ComponentArrayItemField, { type: 'jsonarray' }> => field.type === 'jsonarray'

const isStringArrayField = (
  field: ComponentArrayItemField
): field is Extract<ComponentArrayItemField, { type: 'stringarray' }> => field.type === 'stringarray'

type PropInputType =
  | 'text'
  | 'textarea'
  | 'boolean'
  | 'select'
  | 'json'
  | 'jsonarray'
  | 'jsonobject'
  | 'stringarray'
  | 'number'

const props = defineProps<{
  node: BuilderNodeChild
  registry: ComponentRegistry
  componentOptions: ComponentDefinition[]
  depth?: number
  onUpdateProp: (uid: string, key: string, value: unknown) => void
  onUpdateText: (uid: string, value: string) => void
  onAddChildComponent: (parentUid: string, componentId: string) => void
  onAddChildText: (parentUid: string) => void
  onRemove: (uid: string) => void
}>()

const depth = computed(() => props.depth ?? 0)

const componentDef = computed(() =>
  props.node.type === 'component' ? props.registry.lookup[props.node.component] : undefined
)

const propDraft = reactive<Record<string, any>>({})
const extraPropsDraft = reactive<Record<string, string>>({})
const jsonErrors = reactive<Record<string, string | null>>({})
const objectFieldErrors = reactive<Record<string, Record<string, string | null>>>({})
const textDraft = ref(props.node.type === 'text' ? props.node.value : '')
const selectedChildComponent = ref('')
const newPropKey = ref('')
const newPropValue = ref('')
const draggingArrayItem = ref<{ propKey: string; index: number; type: 'jsonarray' | 'stringarray' } | null>(
  null
)
const dragOverArrayItem = ref<{ propKey: string; index: number } | null>(null)
const collapsedNodes = reactive<Record<string, boolean>>({})
const collapsedArrays = reactive<Record<string, boolean>>({})
const collapsedNestedArrays = reactive<Record<string, boolean>>({})
const insertDialog = reactive<{
  key: string | null
  type: 'jsonarray' | 'stringarray' | null
  schema: ComponentPropSchema | null
}>(
  {
    key: null,
    type: null,
    schema: null
  }
)

const nestedArrayKey = (propKey: string, parentIndex: number, fieldKey: string) =>
  `${propKey}:${parentIndex}:${fieldKey}`

const PROP_UPDATE_DEBOUNCE_MS = 500
const propUpdateTimers = new Map<string, ReturnType<typeof setTimeout>>()

const timerKeyForProp = (key: string) => `${props.node.uid}:${key}`

const schedulePropUpdate = (key: string, value: unknown, type: PropInputType) => {
  if (typeof window === 'undefined') {
    applyProp(key, value, type)
    return
  }

  const timerKey = timerKeyForProp(key)
  const existing = propUpdateTimers.get(timerKey)
  if (existing) {
    window.clearTimeout(existing)
  }

  const timer = window.setTimeout(() => {
    propUpdateTimers.delete(timerKey)
    applyProp(key, value, type)
  }, PROP_UPDATE_DEBOUNCE_MS)

  propUpdateTimers.set(timerKey, timer)
}

const flushPropUpdate = (key: string, value: unknown, type: PropInputType) => {
  if (typeof window !== 'undefined') {
    const timerKey = timerKeyForProp(key)
    const existing = propUpdateTimers.get(timerKey)
    if (existing) {
      window.clearTimeout(existing)
      propUpdateTimers.delete(timerKey)
    }
  }

  applyProp(key, value, type)
}

const commitPropChange = (
  key: string,
  value: unknown,
  type: PropInputType,
  options: { debounce?: boolean } = {}
) => {
  if (options.debounce) {
    schedulePropUpdate(key, value, type)
  } else {
    flushPropUpdate(key, value, type)
  }
}

const marginOptions = [
  { label: 'None', value: '0' },
  { label: 'XS', value: '1' },
  { label: 'SM', value: '2' },
  { label: 'MD', value: '4' },
  { label: 'LG', value: '6' },
  { label: 'XL', value: '8' },
  { label: '2XL', value: '12' },
  { label: '4XL', value: '24' }
]

type MarginSide = 'top' | 'right' | 'bottom' | 'left'
type BreakpointKey = 'base' | 'sm' | 'md' | 'lg' | 'xl'

const marginSides: Array<{ key: MarginSide; label: string; short: string }> = [
  { key: 'top', label: 'Top', short: 'Top' },
  { key: 'right', label: 'Right', short: 'Right' },
  { key: 'bottom', label: 'Bottom', short: 'Bottom' },
  { key: 'left', label: 'Left', short: 'Left' }
]

const responsiveBreakpoints = [
  { key: 'sm', label: 'Small ≥640px', short: 'SM' },
  { key: 'md', label: 'Medium ≥768px', short: 'MD' },
  { key: 'lg', label: 'Large ≥1024px', short: 'LG' },
  { key: 'xl', label: 'XL ≥1280px', short: 'XL' }
] as const

const createMarginState = () => ({ base: '0', sm: '0', md: '0', lg: '0', xl: '0' })

const marginDraft = reactive<Record<MarginSide, Record<BreakpointKey, string>>>([
  'top',
  'right',
  'bottom',
  'left'
].reduce((acc, side) => {
  acc[side as MarginSide] = createMarginState()
  return acc
}, {} as Record<MarginSide, Record<BreakpointKey, string>>))

const showResponsiveMargins = ref(false)

const storageKeyForType = (key: string, type: PropInputType | ComponentPropSchema['type']) =>
  type === 'stringarray' || type === 'jsonarray' || type === 'jsonobject' ? `:${key}` : key

const definedPropKeys = computed(() => {
  const keys = new Set<string>()
  for (const prop of componentDef.value?.props || []) {
    keys.add(prop.key)
    keys.add(storageKeyForType(prop.key, prop.type))
  }
  return keys
})

const extraPropEntries = computed(() => {
  if (props.node.type !== 'component') {
    return [] as Array<{ key: string; value: unknown }>
  }
  return Object.entries(props.node.props)
    .filter(([key]) => !definedPropKeys.value.has(key))
    .map(([key, value]) => ({ key, value }))
})

const getPropSchema = (key: string) => componentDef.value?.props?.find((prop) => prop.key === key)

const cloneValue = <T>(value: T): T => {
  const raw = value && typeof value === 'object' ? (toRaw(value) as T) : value

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(raw)
    } catch (error) {
      console.warn('structuredClone failed, falling back to JSON clone:', error)
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as T
  } catch (error) {
    if (raw && typeof raw === 'object') {
      return { ...(raw as Record<string, unknown>) } as T
    }
    return raw
  }
}

const ensureArrayValue = (value: unknown): Array<Record<string, any>> => {
  const toObject = (entry: unknown) => {
    if (entry && typeof entry === 'object') {
      return cloneValue(entry as Record<string, any>)
    }
    return {}
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toObject(entry))
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => toObject(entry))
      }
    } catch (error) {
      console.warn('Failed to parse JSON array draft value:', error)
    }
  }
  return []
}

const ensureObjectValue = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return cloneValue(value as Record<string, any>)
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>
      }
    } catch (error) {
      console.warn('Failed to parse JSON object draft value:', error)
    }
  }
  return {}
}

const isActiveMarginValue = (value?: string) => Boolean(value && value !== '0' && value !== 'none')

const applyMarginDraftToNode = () => {
  if (props.node.type !== 'component') {
    return
  }
  const next: BuilderNode['margins'] = {}
  for (const side of marginSides) {
    const state = marginDraft[side.key]
    const config: BuilderResponsiveMargin = {}
    if (isActiveMarginValue(state.base)) {
      config.base = state.base
    }
    if (isActiveMarginValue(state.sm)) {
      config.sm = state.sm
    }
    if (isActiveMarginValue(state.md)) {
      config.md = state.md
    }
    if (isActiveMarginValue(state.lg)) {
      config.lg = state.lg
    }
    if (isActiveMarginValue(state.xl)) {
      config.xl = state.xl
    }
    if (Object.keys(config).length) {
      next[side.key] = config
    }
  }

  props.node.margins = Object.keys(next).length ? next : undefined
}

const setMarginDraftFromNode = () => {
  if (props.node.type !== 'component') {
    for (const side of marginSides) {
      const state = marginDraft[side.key]
      state.base = '0'
      state.sm = '0'
      state.md = '0'
      state.lg = '0'
      state.xl = '0'
    }
    showResponsiveMargins.value = false
    return
  }

  let hasResponsive = false
  for (const side of marginSides) {
    const state = marginDraft[side.key]
    const config = props.node.margins?.[side.key]
    state.base = config?.base ?? '0'
    state.sm = config?.sm ?? '0'
    state.md = config?.md ?? '0'
    state.lg = config?.lg ?? '0'
    state.xl = config?.xl ?? '0'
    if (
      isActiveMarginValue(state.sm) ||
      isActiveMarginValue(state.md) ||
      isActiveMarginValue(state.lg) ||
      isActiveMarginValue(state.xl)
    ) {
      hasResponsive = true
    }
  }
  showResponsiveMargins.value = hasResponsive
}

const handleMarginChange = (side: MarginSide, breakpoint: BreakpointKey, value: string) => {
  marginDraft[side][breakpoint] = value
  if (breakpoint !== 'base' && isActiveMarginValue(value)) {
    showResponsiveMargins.value = true
  }
  applyMarginDraftToNode()
}

const resetMargins = () => {
  for (const side of marginSides) {
    const state = marginDraft[side.key]
    state.base = '0'
    state.sm = '0'
    state.md = '0'
    state.lg = '0'
    state.xl = '0'
  }
  showResponsiveMargins.value = false
  applyMarginDraftToNode()
}

const ensureStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? ''))
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry ?? ''))
      }
    } catch (error) {
      console.warn('Failed to parse string array draft value:', error)
    }
  }
  return []
}

const ensureNestedArrayValue = (
  parent: Record<string, any>,
  field: Extract<ComponentArrayItemField, { type: 'jsonarray' }>
) => {
  const storageKey = `:${field.key}`
  if (!(field.key in parent) && storageKey in parent) {
    const legacy = parent[storageKey]
    if (typeof legacy === 'string') {
      try {
        const parsed = JSON.parse(legacy)
        if (Array.isArray(parsed)) {
          parent[field.key] = parsed
        }
      } catch (error) {
        console.warn('Failed to parse legacy nested array value:', error)
      }
    } else if (Array.isArray(legacy)) {
      parent[field.key] = legacy
    }
    delete parent[storageKey]
  }

  const current = parent[field.key]
  if (Array.isArray(current)) {
    if (current.some((entry) => !entry || typeof entry !== 'object')) {
      parent[field.key] = current.map((entry) =>
        entry && typeof entry === 'object'
          ? cloneValue(entry as Record<string, any>)
          : createEmptyArrayItem(field.items || [])
      )
    }
    return parent[field.key] as Array<Record<string, any>>
  }
  if (typeof current === 'string') {
    try {
      const parsed = JSON.parse(current)
      if (Array.isArray(parsed)) {
        parent[field.key] = parsed.map((entry) =>
          entry && typeof entry === 'object'
            ? cloneValue(entry as Record<string, any>)
            : createEmptyArrayItem(field.items || [])
        )
        return parent[field.key] as Array<Record<string, any>>
      }
    } catch (error) {
      console.warn('Failed to parse nested JSON array draft value:', error)
    }
  }
  parent[field.key] = []
  delete parent[storageKey]
  return parent[field.key] as Array<Record<string, any>>
}

const getNestedArrayItems = (
  propKey: string,
  parentIndex: number,
  field: Extract<ComponentArrayItemField, { type: 'jsonarray' }>
) => {
  if (!Array.isArray(propDraft[propKey])) {
    propDraft[propKey] = []
  }
  if (!propDraft[propKey][parentIndex]) {
    propDraft[propKey][parentIndex] = {}
  }
  const parent = propDraft[propKey][parentIndex] as Record<string, any>
  return ensureNestedArrayValue(parent, field)
}

const setNestedArrayItems = (
  propKey: string,
  parentIndex: number,
  field: Extract<ComponentArrayItemField, { type: 'jsonarray' }>,
  items: Array<Record<string, any>>,
  options: { debounce?: boolean } = {}
) => {
  const current = ensureArrayValue(propDraft[propKey])
  const next = current.map((entry) => cloneValue(entry))
  if (!next[parentIndex]) {
    next[parentIndex] = {}
  }
  delete next[parentIndex][`:${field.key}`]
  next[parentIndex][field.key] = items.map((item) => cloneValue(item))
  propDraft[propKey] = next
  commitPropChange(propKey, next, 'jsonarray', options)
}

const isNestedArrayCollapsed = (propKey: string, parentIndex: number, fieldKey: string) => {
  const key = nestedArrayKey(propKey, parentIndex, fieldKey)
  if (!(key in collapsedNestedArrays)) {
    collapsedNestedArrays[key] = true
  }
  return collapsedNestedArrays[key]
}

const toggleNestedArray = (propKey: string, parentIndex: number, fieldKey: string) => {
  const key = nestedArrayKey(propKey, parentIndex, fieldKey)
  collapsedNestedArrays[key] = !(collapsedNestedArrays[key] ?? true)
}

const addNestedArrayItem = (
  propKey: string,
  parentIndex: number,
  field: Extract<ComponentArrayItemField, { type: 'jsonarray' }>
) => {
  const items = getNestedArrayItems(propKey, parentIndex, field)
  const next = [...items, createEmptyArrayItem(field.items || [])]
  collapsedNestedArrays[nestedArrayKey(propKey, parentIndex, field.key)] = false
  setNestedArrayItems(propKey, parentIndex, field, next)
}

const removeNestedArrayItem = (
  propKey: string,
  parentIndex: number,
  field: Extract<ComponentArrayItemField, { type: 'jsonarray' }>,
  index: number
) => {
  const items = getNestedArrayItems(propKey, parentIndex, field)
  const next = items.filter((_, itemIndex) => itemIndex !== index)
  setNestedArrayItems(propKey, parentIndex, field, next)
}

const updateNestedArrayItemField = (
  propKey: string,
  parentIndex: number,
  field: Extract<ComponentArrayItemField, { type: 'jsonarray' }>,
  index: number,
  nestedField: ComponentArrayItemField,
  rawValue: unknown,
  options: { debounce?: boolean } = {}
) => {
  const items = getNestedArrayItems(propKey, parentIndex, field)
  const next = items.map((entry, entryIndex) => {
    if (entryIndex !== index) {
      return entry
    }
    const draft = cloneValue(entry)
    if (isNestedArrayField(nestedField)) {
      const ensured = ensureNestedArrayValue(draft, nestedField)
      let updated: Array<Record<string, any>>
      if (Array.isArray(rawValue)) {
        updated = rawValue.map((value) => (value && typeof value === 'object' ? cloneValue(value) : {}))
      } else {
        try {
          updated = ensureArrayValue(rawValue).map((value) => cloneValue(value))
        } catch (error) {
          updated = ensured
        }
      }
      draft[nestedField.key] = updated
      delete draft[`:${nestedField.key}`]
      return draft
    }
    if (isStringArrayField(nestedField)) {
      draft[nestedField.key] = ensureStringArray(rawValue)
      delete draft[`:${nestedField.key}`]
      return draft
    }
    draft[nestedField.key] = normalizeArrayFieldValue(nestedField, rawValue)
    delete draft[`:${nestedField.key}`]
    return draft
  })
  setNestedArrayItems(propKey, parentIndex, field, next, options)
}

const updateCustomNestedArrayItemField = (
  propKey: string,
  parentIndex: number,
  field: Extract<ComponentArrayItemField, { type: 'jsonarray' }>,
  index: number,
  nestedField: ComponentArrayItemField,
  value: unknown,
  options: { debounce?: boolean } = {}
) => {
  updateNestedArrayItemField(propKey, parentIndex, field, index, nestedField, value, options)
}

const createEmptyArrayItem = (fields: ComponentArrayItemField[]) => {
  const item: Record<string, unknown> = {}
  for (const field of fields) {
    if (isNestedArrayField(field)) {
      item[field.key] = []
      continue
    }
    if (isStringArrayField(field)) {
      item[field.key] = []
      continue
    }
    if (field.type === 'boolean') {
      item[field.key] = false
    } else if (field.type === 'number') {
      item[field.key] = 0
    } else {
      item[field.key] = ''
    }
  }
  return item
}

const formatJsonValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return ''
    }
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    } catch (error) {
      return value
    }
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return ''
  }
}

const hydrateDrafts = () => {
  for (const key of Object.keys(propDraft)) {
    delete propDraft[key]
  }
  for (const key of Object.keys(extraPropsDraft)) {
    delete extraPropsDraft[key]
  }
  for (const key of Object.keys(jsonErrors)) {
    delete jsonErrors[key]
  }
  for (const key of Object.keys(objectFieldErrors)) {
    delete objectFieldErrors[key]
  }

  if (props.node.type === 'component') {
    if (!(props.node.uid in collapsedNodes)) {
      collapsedNodes[props.node.uid] = true
    }
    for (const key of definedPropKeys.value) {
      const schema = getPropSchema(key)
      const storageKey = schema ? storageKeyForType(schema.key, schema.type) : key
      const rawValue = props.node.props?.[storageKey] ?? props.node.props?.[key]

      if (schema?.type === 'boolean') {
        propDraft[key] = Boolean(rawValue)
      } else if (schema?.type === 'json') {
        propDraft[key] = formatJsonValue(rawValue)
        jsonErrors[key] = null
  } else if (schema?.type === 'jsonarray') {
    propDraft[key] = ensureArrayValue(rawValue ?? [])
    if (!(key in collapsedArrays)) {
      collapsedArrays[key] = true
    }
  } else if (schema?.type === 'jsonobject') {
    const storageKey = storageKeyForType(schema.key, schema.type)
    const value = props.node.props?.[storageKey] ?? props.node.props?.[schema.key]
    if (!schema.fields || schema.fields.length === 0) {
      propDraft[key] = formatJsonValue(value)
      jsonErrors[key] = null
    } else {
      propDraft[key] = buildObjectDraft(schema, value)
      objectFieldErrors[key] = {}
    }
  } else if (schema?.type === 'stringarray') {
    propDraft[key] = ensureStringArray(rawValue ?? [])
    if (!(key in collapsedArrays)) {
      collapsedArrays[key] = true
    }
      } else {
        propDraft[key] = rawValue ?? ''
      }
    }
    for (const entry of extraPropEntries.value) {
      extraPropsDraft[entry.key] = String(entry.value ?? '')
    }
    setMarginDraftFromNode()
  } else {
    textDraft.value = props.node.value
    setMarginDraftFromNode()
  }
}

watch(
  () => props.node,
  () => {
    hydrateDrafts()
  },
  { immediate: true, deep: true }
)

const parseValueByType = (value: unknown, type: PropInputType) => {
  if (type === 'boolean') {
    return Boolean(value)
  }
  if (type === 'number') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return value
}

const applyProp = (key: string, value: unknown, type: PropInputType) => {
  if (props.node.type !== 'component') {
    return
  }
  const storageKey = storageKeyForType(key, type)
  if (type === 'json') {
    const input = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    if (!input || !input.trim()) {
      jsonErrors[key] = null
      props.onUpdateProp(props.node.uid, storageKey, [])
      return
    }

    try {
      const parsed = JSON.parse(input)
      jsonErrors[key] = null
      props.onUpdateProp(props.node.uid, storageKey, parsed)
    } catch (error) {
      jsonErrors[key] = 'Invalid JSON'
    }
    return
  }

  if (type === 'jsonarray') {
    const normalized = ensureArrayValue(value)
    jsonErrors[key] = null
    props.onUpdateProp(props.node.uid, storageKey, JSON.stringify(normalized))
    if (storageKey !== key) {
      props.onUpdateProp(props.node.uid, key, undefined)
    }
    return
  }

  if (type === 'stringarray') {
    const normalized = ensureStringArray(value)
    jsonErrors[key] = null
    props.onUpdateProp(props.node.uid, storageKey, JSON.stringify(normalized))
    if (storageKey !== key) {
      props.onUpdateProp(props.node.uid, key, undefined)
    }
    return
  }

  if (type === 'jsonobject') {
    const schema = getPropSchema(key)
    const storageKey = storageKeyForType(key, type)

    if (!schema || !schema.fields || schema.fields.length === 0) {
      const input = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      if (!input || !input.trim()) {
        jsonErrors[key] = null
        props.onUpdateProp(props.node.uid, storageKey, JSON.stringify({}))
        if (storageKey !== key) {
          props.onUpdateProp(props.node.uid, key, undefined)
        }
        return
      }
      try {
        const parsed = JSON.parse(input)
        jsonErrors[key] = null
        const payload = JSON.stringify(parsed)
        props.onUpdateProp(props.node.uid, storageKey, payload)
        if (storageKey !== key) {
          props.onUpdateProp(props.node.uid, key, undefined)
        }
      } catch (error) {
        jsonErrors[key] = 'Invalid JSON'
      }
      return
    }

    const normalized = normalizeObjectDraftValue(schema, value)
    objectFieldErrors[key] = objectFieldErrors[key] || {}
    jsonErrors[key] = null
    const payload = JSON.stringify(normalized)
    props.onUpdateProp(props.node.uid, storageKey, payload)
    if (storageKey !== key) {
      props.onUpdateProp(props.node.uid, key, undefined)
    }
    return
  }

  const parsedValue = parseValueByType(value, type)
  jsonErrors[key] = null
  props.onUpdateProp(props.node.uid, key, parsedValue)
}

onBeforeUnmount(() => {
  if (typeof window === 'undefined') {
    return
  }
  propUpdateTimers.forEach((timer) => window.clearTimeout(timer))
  propUpdateTimers.clear()
})

const handleCustomPropUpdate = (
  schema: ComponentPropSchema,
  value: unknown,
  options: { debounce?: boolean } = {}
) => {
  propDraft[schema.key] = value
  commitPropChange(schema.key, value, schema.type, options)
}

function normalizeArrayFieldValue(field: ComponentArrayItemField, value: unknown) {
  if (isNestedArrayField(field)) {
    return ensureArrayValue(value)
  }
  if (isStringArrayField(field)) {
    return ensureStringArray(value)
  }
  if (field.type === 'boolean') {
    return Boolean(value)
  }
  if (field.type === 'number') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return typeof value === 'string' ? value : value ?? ''
}

function buildObjectDraft(schema: ComponentPropSchema | undefined, value: unknown) {
  const fields = schema?.fields || []
  const baseDefault =
    schema?.default && typeof schema.default === 'object' && !Array.isArray(schema.default)
      ? ensureObjectValue(schema.default)
      : {}
  const source = { ...baseDefault, ...ensureObjectValue(value) }
  const draft: Record<string, any> = {}

  for (const field of fields) {
    const raw = source[field.key]
    if (raw === undefined) {
      if (field.default !== undefined) {
        draft[field.key] = cloneValue(field.default)
      } else if (field.type === 'boolean') {
        draft[field.key] = false
      } else if (field.type === 'jsonarray' || field.type === 'stringarray') {
        draft[field.key] = []
      } else if (field.type === 'number') {
        draft[field.key] = 0
      } else {
        draft[field.key] = ''
      }
    } else {
      draft[field.key] = normalizeArrayFieldValue(field, raw)
    }
  }

  for (const [key, raw] of Object.entries(source)) {
    if (!(key in draft)) {
      draft[key] = cloneValue(raw)
    }
  }

  return draft
}

function normalizeObjectDraftValue(schema: ComponentPropSchema | undefined, value: unknown) {
  const fields = schema?.fields || []
  const draft = ensureObjectValue(value)

  if (fields.length === 0) {
    return cloneValue(draft)
  }

  const result: Record<string, any> = {}
  const allowed = new Set(fields.map((field) => field.key))

  for (const field of fields) {
    const raw = draft[field.key]
    if (raw === undefined) {
      if (field.default !== undefined) {
        result[field.key] = cloneValue(field.default)
      } else if (field.type === 'boolean') {
        result[field.key] = false
      } else if (field.type === 'jsonarray' || field.type === 'stringarray') {
        result[field.key] = []
      } else if (field.type === 'number') {
        result[field.key] = 0
      } else {
        result[field.key] = ''
      }
    } else {
      result[field.key] = normalizeArrayFieldValue(field, raw)
    }
  }

  for (const [key, raw] of Object.entries(draft)) {
    if (!allowed.has(key)) {
      result[key] = cloneValue(raw)
    }
  }

  return result
}

const handleArrayItemFieldChange = (
  propKey: string,
  index: number,
  field: ComponentArrayItemField,
  rawValue: unknown,
  options: { debounce?: boolean } = {}
) => {
  if (isNestedArrayField(field)) {
    return
  }
  if (!Array.isArray(propDraft[propKey])) {
    propDraft[propKey] = []
  }
  const current = ensureArrayValue(propDraft[propKey])
  const next = current.map((item) => ({ ...item }))
  if (!next[index]) {
    next[index] = createEmptyArrayItem(field ? [field] : [])
  }
  next[index][field.key] = normalizeArrayFieldValue(field, rawValue)
  propDraft[propKey] = next
  commitPropChange(propKey, next, 'jsonarray', options)
}

const handleObjectFieldChange = (
  propKey: string,
  field: ComponentArrayItemField,
  rawValue: unknown,
  options: { debounce?: boolean } = {}
) => {
  const schema = getPropSchema(propKey)
  if (!schema || schema.type !== 'jsonobject') {
    return
  }
  const draft = ensureObjectValue(propDraft[propKey])
  draft[field.key] = normalizeArrayFieldValue(field, rawValue)
  propDraft[propKey] = draft
  objectFieldErrors[propKey] = objectFieldErrors[propKey] || {}
  objectFieldErrors[propKey][field.key] = null
  commitPropChange(propKey, draft, 'jsonobject', options)
}

const handleCustomArrayFieldUpdate = (
  propKey: string,
  index: number,
  field: ComponentArrayItemField,
  value: unknown,
  options: { debounce?: boolean } = {}
) => {
  if (isNestedArrayField(field)) {
    return
  }
  handleArrayItemFieldChange(propKey, index, field, value, options)
}

const removeArrayItem = (propKey: string, index: number) => {
  const current = ensureArrayValue(propDraft[propKey])
  current.splice(index, 1)
  propDraft[propKey] = current
  commitPropChange(propKey, current, 'jsonarray')
}
const handleStringArrayChange = (
  propKey: string,
  index: number,
  rawValue: unknown,
  options: { debounce?: boolean } = {}
) => {
  const current = ensureStringArray(propDraft[propKey])
  current[index] = String(rawValue ?? '')
  propDraft[propKey] = current
  commitPropChange(propKey, current, 'stringarray', options)
}

const removeStringArrayItem = (propKey: string, index: number) => {
  const current = ensureStringArray(propDraft[propKey])
  current.splice(index, 1)
  propDraft[propKey] = current
  commitPropChange(propKey, current, 'stringarray')
}

const handleArrayItemDragStart = (
  propKey: string,
  index: number,
  type: 'jsonarray' | 'stringarray',
  event: DragEvent
) => {
  draggingArrayItem.value = { propKey, index, type }
  dragOverArrayItem.value = { propKey, index }
  event.dataTransfer?.setData('text/plain', `${propKey}:${index}`)
  event.dataTransfer?.setDragImage?.((event.target as HTMLElement) || new Image(), 0, 0)
}

const handleArrayItemDragEnter = (propKey: string, index: number) => {
  if (!draggingArrayItem.value) {
    return
  }
  if (draggingArrayItem.value.propKey !== propKey) {
    return
  }
  dragOverArrayItem.value = { propKey, index }
}

const handleArrayItemDragLeave = () => {
  dragOverArrayItem.value = null
}

const reorderArrayItems = (
  propKey: string,
  fromIndex: number,
  toIndex: number,
  type: 'jsonarray' | 'stringarray'
) => {
  if (fromIndex === toIndex) {
    return
  }

  if (type === 'jsonarray') {
    const current = ensureArrayValue(propDraft[propKey])
    if (!current[fromIndex]) {
      return
    }
    const [moved] = current.splice(fromIndex, 1)
    current.splice(toIndex, 0, moved)
    propDraft[propKey] = current
    commitPropChange(propKey, current, 'jsonarray')
    return
  }

  const current = ensureStringArray(propDraft[propKey])
  if (fromIndex < 0 || fromIndex >= current.length) {
    return
  }
  const [moved] = current.splice(fromIndex, 1)
  current.splice(toIndex, 0, moved)
  propDraft[propKey] = current
  commitPropChange(propKey, current, 'stringarray')
}

const handleArrayItemDrop = (
  propKey: string,
  index: number,
  type: 'jsonarray' | 'stringarray'
) => {
  if (!draggingArrayItem.value) {
    return
  }
  const { propKey: sourceKey, index: sourceIndex, type: sourceType } = draggingArrayItem.value
  if (sourceKey !== propKey || sourceType !== type) {
    draggingArrayItem.value = null
    dragOverArrayItem.value = null
    return
  }

  reorderArrayItems(propKey, sourceIndex, index, type)
  draggingArrayItem.value = null
  dragOverArrayItem.value = null
}

const handleArrayItemDragEnd = () => {
  draggingArrayItem.value = null
  dragOverArrayItem.value = null
}

const toggleArray = (key: string) => {
  collapsedArrays[key] = !(collapsedArrays[key] ?? true)
}

const toggleNode = (uid: string) => {
  collapsedNodes[uid] = !(collapsedNodes[uid] ?? true)
}

const openInsertDialog = (schema: ComponentPropSchema) => {
  if (schema.type !== 'jsonarray' && schema.type !== 'stringarray') {
    return
  }
  insertDialog.key = schema.key
  insertDialog.type = schema.type
  insertDialog.schema = schema
  collapsedArrays[schema.key] = false
}

const closeInsertDialog = () => {
  insertDialog.key = null
  insertDialog.type = null
  insertDialog.schema = null
}

const getInsertPositions = () => {
  if (!insertDialog.key || !insertDialog.type) {
    return [] as Array<{ index: number; preview: string }>
  }
  const key = insertDialog.key
  const type = insertDialog.type
  const items =
    type === 'jsonarray'
      ? ensureArrayValue(propDraft[key])
      : ensureStringArray(propDraft[key])
  const positions: Array<{ index: number; preview: string }> = []
  const formatPreview = (value: unknown) => {
    if (type === 'stringarray') {
      return String(value ?? '') || '(empty)'
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
      if (!entries.length) {
        return '(empty object)'
      }
      return entries
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(', ')
    }
    return '(empty)'
  }

  for (let index = 0; index <= items.length; index += 1) {
    const before = index > 0 ? formatPreview(items[index - 1]) : 'Beginning'
    const after = index < items.length ? formatPreview(items[index]) : 'End'
    const preview = `${before} → ${after}`
    positions.push({ index, preview })
  }
  return positions
}

const handleInsertAt = (index: number) => {
  if (!insertDialog.key || !insertDialog.type) {
    return
  }
  const key = insertDialog.key
  const type = insertDialog.type

  if (type === 'jsonarray') {
    const schemaItems = insertDialog.schema?.items || []
    const current = ensureArrayValue(propDraft[key])
    const next = [...current]
    next.splice(index, 0, createEmptyArrayItem(schemaItems))
    propDraft[key] = next
    collapsedArrays[key] = false
    applyProp(key, next, 'jsonarray')
  } else {
    const current = ensureStringArray(propDraft[key])
    const next = [...current]
    next.splice(index, 0, '')
    propDraft[key] = next
    collapsedArrays[key] = false
    applyProp(key, next, 'stringarray')
  }

  closeInsertDialog()
}

const handleAddChildComponent = () => {
  if (!selectedChildComponent.value) {
    return
  }
  props.onAddChildComponent(props.node.uid, selectedChildComponent.value)
  selectedChildComponent.value = ''
}

const handleAddCustomProp = () => {
  if (!newPropKey.value.trim()) {
    return
  }
  props.onUpdateProp(props.node.uid, newPropKey.value.trim(), newPropValue.value)
  newPropKey.value = ''
  newPropValue.value = ''
}

const applyTextValue = () => {
  if (props.node.type !== 'text') {
    return
  }
  props.onUpdateText(props.node.uid, textDraft.value)
}
</script>

<style scoped>
.node-panel {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fff;
}

.node-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /*margin-bottom: 12px;*/
}

.node-panel__header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.node-panel__header-text {
  display: flex;
  flex-direction: column;
}

.node-panel__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-panel__description {
  display: block;
  font-size: 0.875rem;
  color: #64748b;
}

.node-panel__remove {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
}

.node-panel__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-panel__props {
  display: grid;
  gap: 2rem;
}

.node-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-panel__field.is-row {
  flex-direction: row;
  align-items: center;
}

.node-panel__field input,
.node-panel__field textarea,
.node-panel__field select {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #cbd5f5;
}

.node-panel__field--nested {
  background: #f8fafc;
  padding: 8px;
  border: 1px dashed #cbd5f5;
}

.node-panel__array {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-panel__object {
  display: grid;
  gap: 12px;
}

.node-panel__object .node-panel__field--nested {
  margin: 0;
}

.node-panel__margins {
  border-top: 1px dashed #e2e8f0;
  margin-top: 12px;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-panel__margins-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.node-panel__margins-header h4 {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
}

.node-panel__margins-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-panel__margins-toggle {
  font-size: 0.75rem;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #cbd5f5;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.node-panel__margins-toggle:hover,
.node-panel__margins-toggle:focus-visible {
  background: #e0f2fe;
  color: #1d4ed8;
  border-color: #93c5fd;
}

.node-panel__margins-reset {
  font-size: 0.75rem;
  color: #2563eb;
  background: transparent;
  border: none;
  cursor: pointer;
}

.node-panel__margins-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (min-width: 640px) {
  .node-panel__margins-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.node-panel__margins-grid--responsive {
  gap: 8px;
}

.node-panel__margin-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-panel__margin-field select {
  border: 1px solid #cbd5f5;
  border-radius: 4px;
  padding: 6px 8px;
}

.node-panel__array--nested {
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
}

.node-panel__array-header--nested {
  align-items: center;
}

.node-panel__array-header {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
}

.node-panel__array-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #1e293b;
  border-radius: 6px;
  padding: 6px 14px;
  background: #ffffff;
  color: #1e293b;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease;
}

.node-panel__array-toggle:hover,
.node-panel__array-toggle:focus-visible {
  background: #1e293b;
  color: #ffffff;
  box-shadow: 0 10px 25px rgba(30, 41, 59, 0.18);
  border-color: #1e293b;
}

.node-panel__array-toggle::before {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  content: '+';
  font-weight: 600;
  transition: transform 160ms ease;
}

.node-panel__array-toggle[data-state='collapsed']::before {
  content: '+';
}

.node-panel__array-toggle[data-state='expanded']::before {
  content: '–';
}

.node-panel__array-toggle[data-state='expanded']:hover::before,
.node-panel__array-toggle[data-state='expanded']:focus-visible::before {
  transform: rotate(180deg);
}

.node-panel__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #1e293b;
  border-radius: 6px;
  padding: 6px 12px;
  background: #ffffff;
  color: #1e293b;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease;
}

.node-panel__toggle:hover,
.node-panel__toggle:focus-visible {
  background: #1e293b;
  color: #ffffff;
  box-shadow: 0 10px 20px rgba(30, 41, 59, 0.2);
  border-color: #1e293b;
}

.node-panel__toggle::before {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  content: '•';
  font-weight: 600;
  transition: transform 160ms ease;
}

.node-panel__toggle[data-state='collapsed']::before {
  content: '+';
}

.node-panel__toggle[data-state='expanded']::before {
  content: '–';
}

.node-panel__toggle[data-state='expanded']:hover::before,
.node-panel__toggle[data-state='expanded']:focus-visible::before {
  transform: rotate(180deg);
}

.node-panel__array-item {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: move;
}

.node-panel__array-item--nested {
  cursor: default;
  margin-left: 12px;
}

.node-panel__array-fields {
  display: grid;
  gap: 8px;
}

.node-panel__array-fields--nested {
  gap: 6px;
}

.node-panel__array-item--drag-over {
  border-color: #2563eb;
  background: #eff6ff;
}

.node-panel__checkbox {
  position: relative;
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
  order: -1;
}

.node-panel__checkbox-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.node-panel__checkbox-box {
  width: 100%;
  height: 100%;
  border-radius: 0.4rem;
  border: 1.5px solid #94a3b8;
  background: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease;
}

.node-panel__checkbox svg {
  width: 0.9rem;
  height: 0.9rem;
}

.node-panel__checkbox:hover .node-panel__checkbox-box {
  border-color: #2563eb;
}

.node-panel__checkbox-input:focus-visible + .node-panel__checkbox-box {
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
  border-color: #2563eb;
}

.node-panel__checkbox-input:checked + .node-panel__checkbox-box {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}


.node-panel__array-add {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #0f766e;
  border-radius: 6px;
  padding: 6px 14px;
  background: #ffffff;
  color: #0f766e;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease;
}

.node-panel__array-add:hover,
.node-panel__array-add:focus-visible {
  background: #0f766e;
  color: #ffffff;
  box-shadow: 0 10px 25px rgba(15, 118, 110, 0.25);
  border-color: #0f766e;
}


.node-panel__array-add-icon {
  display: inline-flex;
  width: 1.25rem;
  height: 1.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(15, 118, 110, 0.12);
  color: inherit;
  font-size: 1rem;
  transition: transform 160ms ease, background 140ms ease;
}

.node-panel__array-add:hover .node-panel__array-add-icon,
.node-panel__array-add:focus-visible .node-panel__array-add-icon {
  transform: rotate(90deg);
  background: rgba(255, 255, 255, 0.25);
}

.node-panel__array-remove {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
}

.node-panel__insert-dialog {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.node-panel__insert-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
}

.node-panel__insert-content {
  position: relative;
  background: #ffffff;
  border-radius: 10px;
  padding: 24px;
  width: min(420px, 90vw);
  max-height: min(560px, 100vh);
  box-shadow: 0 40px 80px rgba(15, 23, 42, 0.25);
  animation: node-panel__insert-fade 160ms ease-out;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.node-panel__insert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.node-panel__insert-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #0f172a;
}

.node-panel__insert-close {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  color: #475569;
}

.node-panel__insert-subtitle {
  margin: 0;
  color: #64748b;
}

.node-panel__insert-options {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  margin: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  scrollbar-width: thin;
}

.node-panel__insert-options button {
  width: 100%;
  text-align: left;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
  padding: 12px;
  background: #f8fafc;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}

.node-panel__insert-options button strong {
  display: block;
  margin-bottom: 4px;
  color: #1e293b;
}

.node-panel__insert-options button span {
  display: block;
  font-size: 0.85rem;
  color: #475569;
}

.node-panel__insert-options button:hover {
  border-color: #2563eb;
  background: #eff6ff;
}

@keyframes node-panel__insert-fade {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.node-panel__children {
  margin-top: 8px;
}

.node-panel__error {
  color: #ef4444;
  font-size: 0.75rem;
}

.node-panel__children-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.node-panel__hint {
  font-size: 0.8rem;
  color: #64748b;
  margin: 8px 0;
}

.node-panel__new-prop {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.node-panel__new-prop input {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #cbd5f5;
}

.node-panel__margins-responsive {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-panel__margins-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px dashed #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
}

.node-panel__margin-breakpoint {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #475569;
}

.node-panel__new-prop button {
  padding: 6px 12px;
}

.node-panel__text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
