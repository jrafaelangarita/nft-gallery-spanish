<template>
  <b-field>
    <b-dropdown
      v-if="multipleSelect"
      multiple
      v-model="selectedAction"
      class="select-dropdown">
      <template #trigger>
        <b-button
          type="is-primary"
          icon-right="caret-down"
          data-cy="gallery-sort-by">
          Sort by
        </b-button>
      </template>
      <b-dropdown-item
        v-for="action in actions"
        :key="action"
        :value="action"
        :data-cy="$t('sort.' + action)">
        {{ $t('sort.' + action) }}
      </b-dropdown-item>
    </b-dropdown>
    <b-select
      v-else
      v-model="selectedAction"
      placeholder="Sort by"
      class="select-dropdown"
      data-cy="collection-sort-by">
      <option v-for="action in actions" :key="action" :value="action">
        {{
          isCollection ? $t('sort.collection.' + action) : $t('sort.' + action)
        }}
      </option>
    </b-select>
  </b-field>
</template>

<script lang="ts">
import { Component, mixins, VModel, Prop } from 'nuxt-property-decorator'
import {
  NFT_SORT_CONDITION_LIST,
  NFT_SQUID_SORT_CONDITION_LIST,
} from '@/utils/constants'
import PrefixMixin from '@/utils/mixins/prefixMixin'

@Component
export default class SearchSortDropdown extends mixins(PrefixMixin) {
  @VModel({ type: [Array, String] }) selectedAction!: string | string[]
  @Prop(Array) public sortOption?: string[]
  @Prop(Boolean) public multipleSelect!: boolean
  @Prop({ type: Boolean, default: false }) public isCollection?: boolean

  get actions(): string[] {
    return this.sortOption || this.sort
  }

  get sort(): string[] {
    return this.urlPrefix === 'rmrk'
      ? NFT_SORT_CONDITION_LIST
      : NFT_SQUID_SORT_CONDITION_LIST
  }
}
</script>

<style lang="scss">
@import '@/styles/variables';

.select-dropdown {
  select {
    border: 1px solid $primary !important;
  }
  @media screen and (max-width: 1216px) and (min-width: 768px) {
    width: 200px;
  }
}
</style>
