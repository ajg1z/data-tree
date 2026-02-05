import type { EnginePlugin, RebuildViewStateEffect, ViewMetadata } from './types'
import type { TreeDataEngine } from './TreeDataEngine'

export class ViewPipeline {
  run(
    plugins: EnginePlugin[],
    base: ViewMetadata,
    engine: TreeDataEngine<any, any>,
    effect?: RebuildViewStateEffect
  ): { metadata: ViewMetadata, isUpdated: boolean } {

    let metadata = base
    let isUpdated = false

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i]

      if (plugin && plugin.run) {
        const result = plugin.run({
          metadata,
          index: i,
          originalMetadata: base,
          isUpdated,
          effect,
        }, engine)

        metadata = result.data
        isUpdated = result.isUpdated
      }
    }

    return { metadata, isUpdated }
  }
}