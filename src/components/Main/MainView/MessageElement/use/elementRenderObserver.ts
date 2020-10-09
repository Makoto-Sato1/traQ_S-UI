import { SetupContext, Ref, watchEffect, watch } from 'vue'
import { FileId } from '@/types/entity-ids'
import { Message } from '@traptitech/traq'
import { ResizeObserverWindow } from '@/types/ResizeObserver'
import { useRoute } from 'vue-router'

declare const window: ResizeObserverWindow

export const emitsOption = {
  'entry-message-loaded': (height: number) => true,
  'change-height': (changed: {
    heightDiff: number
    top: number
    bottom: number
    lastTop: number
    lastBottom: number
    date?: string
  }) => true
}

const useElementRenderObserver = (
  bodyRef: Ref<HTMLDivElement | null>,
  props: { isEntryMessage: boolean },
  state: Readonly<{
    content: string
    message?: Message
  }>,
  embeddingsState: Readonly<{
    fileIds: Readonly<FileId[]>
  }>,
  context: SetupContext<typeof emitsOption>
) => {
  const route = useRoute()

  let lastHeight = 0
  let lastBottom = 0
  let lastTop = 0
  const resizeObserver = new window.ResizeObserver(entries => {
    const entry = entries[0]
    const { height, bottom, top } = entry.target.getBoundingClientRect()
    if (lastHeight === 0) {
      // 初回に高さが変化した場合、初期レンダリング完了とみなす
      // これ以降新規にobserveしないためにwatcherを止める
      stop()

      // エントリーメッセージだった場合は高さを報告する
      if (bodyRef.value && props.isEntryMessage) {
        const parentTop =
          bodyRef.value.parentElement?.getBoundingClientRect().top ?? 0
        const { top } = bodyRef.value.getBoundingClientRect()
        context.emit('entry-message-loaded', top - parentTop)
      }
    } else {
      context.emit('change-height', {
        heightDiff: height - lastHeight,
        top,
        bottom,
        lastTop,
        lastBottom,
        date: state.message?.createdAt
      })
    }
    lastHeight = height
    lastBottom = bottom
    lastTop = top
  })
  const stop = watchEffect(async () => {
    if (
      (props.isEntryMessage || embeddingsState.fileIds.length > 0) &&
      bodyRef.value
    ) {
      // 添付ファイルがある場合か、エントリーメッセージは高さ監視をする
      resizeObserver.observe(bodyRef.value, { box: 'border-box' })
    }
  })
  watch(
    () => route.path,
    () =>
      // パス変更でunobserve
      // vue-routerのインスタンス再利用対策
      bodyRef.value ? resizeObserver.unobserve(bodyRef.value) : undefined
  )
}

export default useElementRenderObserver
