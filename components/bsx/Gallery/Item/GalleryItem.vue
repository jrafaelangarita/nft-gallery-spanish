<template>
  <BaseGalleryItem
    v-if="nft"
    :image="meta.image"
    :animationUrl="meta.animation_url"
    :mimeType="mimeType"
    :description="meta.description"
    :imageVisible="imageVisible"
    :isLoading="isLoading"
    @mouseEntered="showNavigation = true"
    @mouseLeft="showNavigation = false">
    <template v-slot:top v-if="message">
      <b-message class="message-box" type="is-primary">
        <div class="columns">
          <div class="column is-four-fifths">
            <p class="title is-3 has-text-black">{{ $t('mint.success') }} 🎉</p>
            <p class="subtitle is-size-5 subtitle-text">
              {{ $t('mint.shareWithFriends', [nft.name]) }} △
            </p>
          </div>
          <div class="column">
            <Sharing :enableDownload="isOwner" />
          </div>
        </div>
      </b-message>
    </template>
    <template v-slot:image>
      <Navigation
        v-if="nftsFromSameCollection.length > 1"
        :showNavigation="showNavigation"
        :items="nftsFromSameCollection"
        :currentId="nft.id" />
    </template>
    <template v-slot:main>
      <div class="columns">
        <div class="column is-6">
          <div class="mb-5">
            <Name :nft="nft" :isLoading="isLoading" />
          </div>

          <div v-if="meta.description" class="block">
            <p class="label">{{ $t('legend') }}</p>
            <VueMarkdown
              v-if="!isLoading"
              class="is-size-5"
              :style="{ wordBreak: 'break-word' }"
              :source="meta.description.replaceAll('\n', '  \n')" />
            <b-skeleton
              :count="3"
              size="is-large"
              :active="isLoading"></b-skeleton>
          </div>

          <div class="block" v-if="meta.attributes && meta.attributes.length">
            <Properties :attributes="meta.attributes" fieldKey="trait_type" />
          </div>
        </div>

        <div class="column is-6" v-if="detailVisible">
          <b-skeleton
            :count="2"
            size="is-large"
            :active="isLoading"></b-skeleton>

          <div class="columns">
            <div class="column">
              <div class="nft-title">
                <Detail :nft="nft" :isLoading="isLoading" />
              </div>
            </div>
            <div
              class="column is-flex is-flex-direction-column is-justify-content-space-between">
              <template v-if="detailVisible && !nft.burned">
                <div class="card bordered mb-4" aria-id="contentIdForA11y3">
                  <div class="card-content">
                    <template v-if="hasPrice">
                      <div class="label">
                        {{ $t('price') }}
                      </div>
                      <div class="price-block__container">
                        <div class="price-block__original">
                          <Money :value="nft.price" inline data-cy="money" />
                        </div>
                        <b-button
                          v-if="nft.currentOwner === accountId"
                          class="ml-2 only-border-top"
                          type="is-warning"
                          outlined
                          @click="handleUnlist">
                          {{ $t('Unlist') }}
                        </b-button>
                      </div>
                      <div v-if="nftRoyalties">
                        ⊆ {{ $t('royalty') }}
                        <Money :value="nftRoyalties" inline />
                      </div>
                    </template>
                    <div class="content pt-4">
                      <p class="subtitle">
                        <AvailableActions
                          ref="actions"
                          :account-id="accountId"
                          :is-owner="isOwner"
                          :current-owner-id="nft.currentOwner"
                          :price="nft.price"
                          :nftId="id"
                          :delegateId="nft.delegate"
                          :collectionId="collectionId"
                          :frozen="nft.isFrozen"
                          :isMakeOffersAllowed="isMakeOffersAllowed"
                          :isBuyAllowed="isBuyAllowed"
                          :ipfs-hashes="[
                            nft.image,
                            nft.animation_url,
                            nft.metadata,
                          ]"
                          @change="handleAction" />
                        <Auth class="mt-4" />
                      </p>
                    </div>
                    <AccountBalance />
                    <Sharing :enableDownload="isOwner" class="mb-4" />
                  </div>
                </div>
              </template>
            </div>
          </div>
          <b-skeleton
            :count="2"
            size="is-large"
            :active="isLoading"></b-skeleton>
        </div>
      </div>
    </template>
    <template v-slot:footer>
      <OfferList
        :current-owner-id="nft.currentOwner"
        :nftId="id"
        @offersUpdate="offersUpdate"
        :collectionId="collectionId"
        data-cy="offer-list" />
      <History :events="events" :openOnDefault="false" data-cy="history" />
    </template>
  </BaseGalleryItem>
</template>

<script lang="ts">
import {
  Emote,
  Interaction,
  NFT,
  NFTMetadata,
} from '@/components/rmrk/service/scheme'
import {
  fetchNFTMetadata,
  getSanitizer,
  sanitizeIpfsUrl,
} from '@/components/rmrk/utils'
import { createTokenId, tokenIdToRoute } from '@/components/unique/utils'
import itemEvents from '@/queries/subsquid/bsx/itemEvents.graphql'
import { isOwner } from '@/utils/account'
import { toHuman, unwrapOrDefault, unwrapOrNull } from '@/utils/api/format'
import Orientation from '@/utils/directives/DeviceOrientation'
import { emptyObject } from '@/utils/empty'
import { formatBsxBalanceEmptyOnZero } from '@/utils/format/balance'
import { processMedia } from '@/utils/gallery/media'
import isShareMode from '@/utils/isShareMode'
import ApiUrlMixin from '@/utils/mixins/apiUrlMixin'
import AuthMixin from '@/utils/mixins/authMixin'
import PrefixMixin from '@/utils/mixins/prefixMixin'
import SubscribeMixin from '@/utils/mixins/subscribeMixin'
import { notificationTypes, showNotification } from '@/utils/notification'
import resolveQueryPath from '@/utils/queryPathResolver'
import { royaltyOf } from '@/utils/royalty'
import { generateNftImage } from '@/utils/seoImageGenerator'
import { ShoppingActions } from '@/utils/shoppingActions'
import { isEmpty } from '@kodadot1/minimark'
import { onApiConnect } from '@kodadot1/sub-api'
import { Option, u128 } from '@polkadot/types'
import { InstanceDetails } from '@polkadot/types/interfaces'
import { get, set } from 'idb-keyval'
import { Component, mixins, Vue } from 'nuxt-property-decorator'
import { getMetadata, getOwner, getPrice, hasAllPallets } from './utils'
import AvailableActions from './AvailableActions.vue'
import nftListIdsByCollection from '@/queries/subsquid/general/nftIdListByCollection.graphql'
import { unwrapSafe } from '@/utils/uniquery'
import { mapToId } from '@/utils/mappers'

@Component<GalleryItem>({
  name: 'GalleryItem',
  head() {
    const metaData = {
      mime: this.mimeType,
      title: this.pageTitle,
      description: this.meta.description,
      url: this.$route.path,
      image: this.image,
      video: this.meta.animation_url,
    }
    return {
      title: this.pageTitle,
      meta: [...this.$seoMeta(metaData)],
    }
  },
  components: {
    Auth: () => import('@/components/shared/Auth.vue'),
    AvailableActions: () => import('./AvailableActions.vue'),
    Name: () => import('@/components/rmrk/Gallery/Item/Name.vue'),
    Sharing: () => import('@/components/rmrk/Gallery/Item/Sharing.vue'),
    IndexerGuard: () => import('@/components/shared/wrapper/IndexerGuard.vue'),
    VueMarkdown: () => import('vue-markdown-render'),
    Detail: () => import('@/components/unique/Gallery/Item/Detail.vue'),
    DangerModal: () =>
      import('@/components/unique/Gallery/Item/DangerModal.vue'),
    Properties: () => import('@/components/unique/Gallery/Item/Properties.vue'),
    BaseGalleryItem: () =>
      import('@/components/shared/gallery/BaseGalleryItem.vue'),
    Money: () => import('@/components/shared/format/Money.vue'),
    AccountBalance: () => import('@/components/shared/AccountBalance.vue'),
    OfferList: () => import('@/components/bsx/Offer/OfferList.vue'),
    History: () => import('@/components/rmrk/Gallery/History.vue'),
    Navigation: () => import('@/components/rmrk/Gallery/Item/Navigation.vue'),
  },
  directives: {
    orientation: Orientation,
  },
})
export default class GalleryItem extends mixins(
  SubscribeMixin,
  PrefixMixin,
  AuthMixin,
  ApiUrlMixin
) {
  private id = ''
  private collectionId = ''
  private nft: NFT = emptyObject<NFT>()
  private imageVisible = true
  public isLoading = false
  public mimeType = ''
  public meta: NFTMetadata = emptyObject<NFTMetadata>()
  public emotes: Emote[] = []
  public events: Interaction[] = []
  public message = ''
  public isMakeOffersAllowed = true
  public showNavigation = false
  private nftsFromSameCollection: string[] = []

  public async created() {
    this.checkId()
    await this.fetchNftData()
    await this.fetchEvents()
    this.fetchCollectionItems()
    onApiConnect(this.apiUrl, (api) => {
      if (hasAllPallets(api)) {
        this.subscribe(getOwner(api), this.tokenId, this.observeOwner)
        this.subscribe(getPrice(api), this.tokenId, this.observePrice)
      }
    })
  }

  get isOwner(): boolean {
    return isOwner(this.nft.currentOwner, this.accountId)
  }

  get balance(): string {
    return this.$store.getters.getAuthBalance
  }

  get tokenId(): [string, string] {
    return [this.collectionId, this.id]
  }

  get pageTitle(): string {
    return this.nft?.name || ''
  }

  get image(): string {
    return generateNftImage(
      this.nft.name,
      formatBsxBalanceEmptyOnZero(this.nft.price as string),
      this.meta.image as string,
      this.mimeType
    )
  }

  public offersUpdate({ offers }) {
    this.isMakeOffersAllowed = !offers.find(({ caller }) => {
      return caller === this.accountId
    })
  }

  protected observeOwner(data: Option<InstanceDetails>) {
    const instance = unwrapOrNull(data)
    if (instance) {
      this.$set(this.nft, 'currentOwner', toHuman(instance.owner))
    }
  }

  protected observePrice(data: Option<u128>) {
    this.$set(this.nft, 'price', unwrapOrDefault(data).toString())
  }

  public async fetchCollectionItems() {
    const collectionId = this.nft?.collection.id
    if (collectionId) {
      // cancel request and get ids from store in case we already fetched collection data before
      if (this.$store.state.history?.currentCollection?.id === collectionId) {
        this.nftsFromSameCollection =
          this.$store.state.history.currentCollection?.nftIds || []
        return
      }
      try {
        const nfts = await this.$apollo.query({
          query: nftListIdsByCollection,
          client: this.client,
          variables: {
            id: collectionId,
          },
        })

        const {
          data: { nftEntities },
        } = nfts

        this.nftsFromSameCollection = unwrapSafe(nftEntities).map(mapToId) || []
        this.$store.dispatch('history/setCurrentCollection', {
          id: collectionId,
          nftIds: this.nftsFromSameCollection,
          prefix: this.urlPrefix,
        })
      } catch (e) {
        showNotification(`${e}`, notificationTypes.warn)
      }
    }
  }

  private async fetchEvents() {
    const result = await this.$apollo.query({
      query: itemEvents,
      client: this.urlPrefix,
      variables: {
        id: createTokenId(this.collectionId, this.id),
      },
    })
    if (result.data && result.data.events) {
      this.events = [...result.data.events]
    }
  }

  protected handleUnlist() {
    const availableActions = this.$refs.actions as AvailableActions
    availableActions.unlistNft()
  }

  private async fetchNftData() {
    const query = await resolveQueryPath(this.urlPrefix, 'nftById')
    const nft = await this.$apollo.query({
      query: query.default,
      client: this.urlPrefix,
      variables: {
        id: createTokenId(this.collectionId, this.id),
      },
    })
    const {
      data: { nftEntity },
    } = nft

    if (!nftEntity) {
      this.$consola.warn(`No NFT with ID ${this.id} fallback to RPC Node`)
      this.fetchRPCMetadata()
      // showNotification(`No NFT with ID ${this.id}`, notificationTypes.warn)
      return
    }

    this.nft = {
      ...this.nft,
      ...nftEntity,
    }

    if (nftEntity.meta) {
      this.meta = {
        ...this.meta,
        ...nftEntity.meta,
        image: sanitizeIpfsUrl(nftEntity.meta.image || ''),
      }
    }

    this.fetchMetadata()
  }

  protected fetchRPCMetadata() {
    onApiConnect(this.apiUrl, async (api) => {
      const metacall = getMetadata(api)
      const res = await metacall(this.collectionId, this.id).then((option) =>
        unwrapOrNull(option as Option<any>)
      )
      if (res) {
        Vue.set(this.nft, 'metadata', res.metadata.toHuman())
        this.fetchMetadata()
      }
    })
  }

  onImageError(e: any) {
    this.$consola.warn('Image error', e)
  }

  public async fetchMetadata() {
    if (this.nft['metadata']) {
      const cachedMeta = await get(this.nft.metadata)

      const meta = !isEmpty(cachedMeta)
        ? cachedMeta
        : await fetchNFTMetadata(
            this.nft,
            getSanitizer(this.nft.metadata, 'pinata', 'permafrost')
          )

      const imageSanitizer = getSanitizer(meta.image, 'pinata')
      this.meta = {
        ...meta,
        image: imageSanitizer(meta.image),
        animation_url: sanitizeIpfsUrl(
          meta.animation_url || meta.image,
          'pinata'
        ),
      }

      if (!this.nft.name && meta.name) {
        Vue.set(this.nft, 'name', meta.name)
      }

      if (this.meta.animation_url && !this.mimeType) {
        const { mimeType, imageVisible } = await processMedia(
          this.meta.animation_url
        )
        this.mimeType = mimeType
        this.imageVisible = imageVisible
      }

      if (!cachedMeta && !isEmpty(meta)) {
        set(this.nft.metadata, meta)
      }
    }
  }

  public checkId() {
    if (this.$route.params.id) {
      const { id, item } = tokenIdToRoute(this.$route.params.id)
      this.id = item
      this.collectionId = id
    }
  }

  public toast(message: string): void {
    this.$buefy.toast.open(message)
  }

  get hasPrice(): boolean {
    return Number(this.nft.price) > 0
  }

  get nftRoyalties(): string {
    return this.nft.price && this.nft.royalty
      ? royaltyOf(this.nft.price, this.nft.royalty)
      : ''
  }

  get nftId() {
    const { id } = this.nft
    return id
  }

  get detailVisible() {
    return !isShareMode
  }

  // @Watch('meta', { deep: true })
  // handleNFTPopulationFinished(newVal) {
  //   if (newVal) {
  //     // save visited detail page to history
  //     this.$store.dispatch('history/addHistoryItem', {
  //       id: this.id,
  //       name: this.nft.name,
  //       image: this.meta.image,
  //       collection: (this.nft.collection as any).name,
  //       date: new Date(),
  //       description: this.meta.description,
  //       author: this.nft.currentOwner,
  //       price: this.nft.price,
  //       mimeType: this.mimeType,
  //       prefix: this.urlPrefix,
  //     })
  //   }
  // }

  get isBuyAllowed(): boolean {
    if (!this.nft.price) {
      return false
    }
    return parseFloat(this.balance) > parseFloat(this.nft.price)
  }

  protected handleAction(action: ShoppingActions) {
    const deleted = action === ShoppingActions.CONSUME
    if (deleted) {
      showNotification('INSTANCE REMOVED', notificationTypes.warn)
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  }
}
</script>
<style scoped lang="scss">
@import '@/styles/border';
</style>
