<template>
  <div class="columns mb-6">
    <div class="column is-6 is-offset-3">
      <section>
        <br />
        <Loader v-model="isLoading" :status="status" />
        <div class="box">
          <p class="title is-size-3">
            {{ $t('action.admin') }}
          </p>
          <b-field>
            <Auth />
          </b-field>

          <template v-if="accountId">
            <b-field :label="$t('collection')">
              <b-select
                placeholder="Select a collection"
                v-model="selectedCollection"
                expanded>
                <option
                  v-for="option in collections"
                  :value="option"
                  :key="option.id">
                  {{ option.name }} {{ option.id }} ({{ option.available }})
                </option>
              </b-select>
            </b-field>
          </template>
          <h6 v-if="selectedCollection" class="subtitle is-6">
            NFTs to process ({{ selectedCollection.available }} pieces)
          </h6>
          <b-field v-if="!selectedCollection && !collections.length">
            <NoCollection label="helper.noCollections" />
          </b-field>

          <template v-if="selectedCollection">
            <ActionSelector v-model="action" />
            <component
              class="mb-4"
              v-if="showMeta"
              :is="showMeta"
              @input="updateMeta" />

            <BasicSwitch v-model="listed" label="action.omitListed" />

            <b-field>
              <PasswordInput v-model="password" :account="accountId" />
            </b-field>
            <b-field>
              <b-button
                type="is-primary"
                icon-left="paper-plane"
                @click="sub"
                :disabled="disabled"
                :loading="isLoading"
                outlined>
                {{ $t('action.click', [action]) }}
              </b-button>
            </b-field>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
import { AdminNFT, ProcessFunction } from '@/components/accounts/utils'
import collectionByAccountWithTokens from '@/queries/collectionByAccountWithTokens.graphql'
import ChainMixin from '@/utils/mixins/chainMixin'
import PrefixMixin from '@/utils/mixins/prefixMixin'
import RmrkVersionMixin from '@/utils/mixins/rmrkVersionMixin'
import SubscribeMixin from '@/utils/mixins/subscribeMixin'
import TransactionMixin from '@/utils/mixins/txMixin'
import { notificationTypes, showNotification } from '@/utils/notification'
import shouldUpdate from '@/utils/shouldUpdate'
import exec, { execResultValue, txCb } from '@/utils/transactionExecutor'
import {
  createInteraction,
  Interaction,
  mapAsSystemRemark,
} from '@kodadot1/minimark'
import { DispatchError } from '@polkadot/types/interfaces'
import { Component, mixins, Watch } from 'nuxt-property-decorator'
import UseApiMixin from '~/utils/mixins/useApiMixin'

type EmptyPromise = Promise<void>

type MintedCollection = {
  id: string
  name: string
  available: number
  max: number
  metadata: string
  symbol: string
  nfts: { id: string; price: string }[]
}

const needMeta: Record<string, string> = {
  SEND: 'SendHandler',
}

const components = {
  Auth: () => import('@/components/shared/Auth.vue'),
  PasswordInput: () => import('@/components/shared/PasswordInput.vue'),
  BalanceInput: () => import('@/components/shared/BalanceInput.vue'),
  Loader: () => import('@/components/shared/Loader.vue'),
  NoCollection: () => import('@/components/shared/wrapper/NoCollection.vue'),
  ActionSelector: () => import('./ActionSelector.vue'),
  BasicSwitch: () => import('@/components/shared/form/BasicSwitch.vue'),
  SendHandler: () => import('./SendHandler.vue'),
}

@Component<AdminPanel>({
  components,
})
export default class AdminPanel extends mixins(
  SubscribeMixin,
  RmrkVersionMixin,
  TransactionMixin,
  ChainMixin,
  PrefixMixin,
  UseApiMixin
) {
  protected commands = ''
  private password = ''
  private action: Interaction.SEND | Interaction.CONSUME | Interaction.LIST =
    Interaction.CONSUME
  protected collections: MintedCollection[] = []
  private selectedCollection: MintedCollection | null = null
  private isMetaValid = false
  protected listed = true
  protected metaFunction: ProcessFunction | undefined = undefined

  public async fetchCollections(): EmptyPromise {
    const collections = await this.$apollo.query({
      query: collectionByAccountWithTokens,
      client: this.urlPrefix,
      variables: {
        account: this.accountId,
      },
      fetchPolicy: 'network-only',
    })

    const {
      data: { collectionEntities },
    } = collections

    this.collections = collectionEntities.nodes
      ?.map((ce: any) => ({
        ...ce,
        available: ce.nfts?.totalCount,
        nfts: ce.nfts?.nodes?.map((n: AdminNFT) => n),
      }))
      .filter((ce: MintedCollection) => ce.available > 0)
  }

  @Watch('accountId', { immediate: true })
  hasAccount(value: string, oldVal: string): void {
    if (shouldUpdate(value, oldVal)) {
      this.fetchCollections()
    }
  }

  get accountId() {
    return this.$store.getters.getAuthAddress
  }

  get disabled(): boolean {
    return Boolean(this.showMeta && !this.isMetaValid)
  }

  private skipListed(nft: AdminNFT) {
    return this.listed ? Number(nft.price) === 0 : true
  }

  get showMeta() {
    return needMeta[this.action]
  }

  protected updateMeta(value: {
    metaFunction: ProcessFunction
    isValidMeta: boolean
  }): void {
    this.isMetaValid = value.isValidMeta
    this.metaFunction = value.metaFunction
  }

  protected async sub(): EmptyPromise {
    if (!this.selectedCollection) {
      throw ReferenceError('[MASS MINT] Unable to mint without collection')
    }

    this.isLoading = true

    this.initTransactionLoader()
    this.status = 'loader.ipfs'

    try {
      this.status = 'loader.sign'
      const api = await this.useApi()
      const toRemark = mapAsSystemRemark(api)

      const cb = api.tx.utility.batchAll

      const nfts = this.selectedCollection.nfts.filter(this.skipListed)
      // .map(nft => NFTUtils.createInteraction(this.action, this.version, nft.id, ''))

      const final =
        this.showMeta && this.metaFunction
          ? this.metaFunction(nfts, this.version)
          : nfts.map((nft) =>
              createInteraction(this.action, this.version, nft.id, '')
            )

      const args = final.map(toRemark)

      const tx = await exec(
        this.accountId,
        '',
        cb,
        [args],
        txCb(
          async (blockHash) => {
            execResultValue(tx)
            const header = await api.rpc.chain.getHeader(blockHash)
            const blockNumber = header.number.toString()

            showNotification(
              `[NFT] ${this.action} ${nfts.length} entries in block ${blockNumber}`,
              notificationTypes.success
            )

            this.isLoading = false
          },
          (dispatchError) => {
            execResultValue(tx)
            this.onTxError(dispatchError)
            this.isLoading = false
          },
          (res) => this.resolveStatus(res.status)
        )
      )
    } catch (e) {
      showNotification((e as Error).toString(), notificationTypes.danger)
      this.isLoading = false
    }
  }

  protected async onTxError(dispatchError: DispatchError): EmptyPromise {
    const api = await this.useApi()
    if (dispatchError.isModule) {
      const decoded = api.registry.findMetaError(dispatchError.asModule)
      const { docs, name, section } = decoded
      showNotification(
        `[ERR] ${section}.${name}: ${docs.join(' ')}`,
        notificationTypes.danger
      )
    } else {
      showNotification(
        `[ERR] ${dispatchError.toString()}`,
        notificationTypes.danger
      )
    }

    this.isLoading = false
  }
}
</script>
