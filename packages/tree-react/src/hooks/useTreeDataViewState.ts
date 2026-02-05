import { useSyncExternalStore } from 'react'
import type { TreeDataEngine } from '@ajgiz/tree-core'

export const useTreeDataViewState = <Props extends Record<string, any> = Record<string, any>, ViewOpts extends Record<string, any> = Record<string, any>>(engine: TreeDataEngine<Props, ViewOpts>) =>
  useSyncExternalStore(
    engine.subscribe.bind(engine),
    engine.getViewState.bind(engine),
    engine.getViewState.bind(engine),
  )
