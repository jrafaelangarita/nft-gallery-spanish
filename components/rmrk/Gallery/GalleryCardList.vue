<template>
  <div>
    <template v-if="items && !horizontalLayout">
      <Layout />
    </template>
    <div :id="scrollContainerId" class="columns is-multiline">
      <div
        :class="`column ${classLayout} column-padding ${scrollItemClassName}`"
        v-for="nft in items"
        :key="nft.id">
        <GalleryCard
          :id="nft.id"
          :name="nft.name"
          :route="route"
          :link="link"
          :metadata="metadataOf(nft)"
          :price="nft.price"
          :emoteCount="nft.emoteCount"
          :currentOwner="nft.currentOwner"
          :listed="listed"
          :data-cy="items.indexOf(nft)" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'nuxt-property-decorator'
import { RmrkType } from '@/components/rmrk/service/scheme'
import {
  INFINITE_SCROLL_CONTAINER_ID,
  INFINITE_SCROLL_ITEM_CLASS_NAME,
} from '~/utils/mixins/infiniteScrollMixin'

const components = {
  GalleryCard: () => import('./GalleryCard.vue'),
  Layout: () => import('./Layout.vue'),
}

@Component({ components })
export default class GalleryCardList extends Vue {
  @Prop({ default: '/rmrk/gallery' }) public route!: string
  @Prop({ default: 'rmrk/gallery' }) public link!: string
  @Prop() public items!: RmrkType[]
  @Prop(Boolean) public horizontalLayout!: boolean
  @Prop(Boolean) public listed!: boolean
  protected scrollContainerId = INFINITE_SCROLL_CONTAINER_ID
  protected scrollItemClassName = INFINITE_SCROLL_ITEM_CLASS_NAME

  get classLayout() {
    return this.$store.getters['preferences/getLayoutClass']
  }

  protected metadataOf(nft: any) {
    return nft.metadata || nft.collection?.metadata
  }
}
</script>
<style>
/* TODO: move to global */
.b-radio.radio.button.is-selected {
  background-color: #db2980;
}
</style>
