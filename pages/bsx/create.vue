<template>
  <section>
    <br />
    <b-tabs v-model="activeTab" destroy-on-hide expanded>
      <b-tab-item v-for="x in components" :key="x" :label="x">
        <component
          :showExplainerText="showExplainerText"
          :is="x"
          @navigateToCreateNftTab="switchToNft"
          v-if="components[activeTab] === x" />
      </b-tab-item>
    </b-tabs>
  </section>
</template>

<script lang="ts">
import { Component, mixins } from 'nuxt-property-decorator'
import CreateMixin from '~/utils/mixins/createMixin'

const Collection = () => import('@/components/bsx/Create/Create.vue')
const NFT = () => import('@/components/bsx/Create/CreateToken.vue')

const components = { Collection, NFT }

@Component<BsxCreatePage>({
  components,
  layout() {
    return 'centered-half-layout'
  },
  head() {
    const title = 'KodaDot | Low fees and low carbon minting'
    const metaData = {
      title,
      type: 'article',
      description: 'Create carbonless NFTs with low on-chain fees',
      url: '/statemine/create',
      image: `${this.$config.baseUrl}/k_card_mint.png`,
    }
    return {
      title,
      link: [
        {
          hid: 'canonical',
          rel: 'canonical',
          href: this.$root.$config.baseUrl + this.$route.path,
        },
      ],
      meta: [...this.$seoMeta(metaData)],
    }
  },
})
export default class BsxCreatePage extends mixins(CreateMixin) {
  public showExplainerText = false

  protected switchToNft() {
    this.switchToCreateNFT()
    this.showExplainerText = true
  }
}
</script>
