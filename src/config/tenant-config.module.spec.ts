import 'reflect-metadata'
import { AggregationModule } from '../aggregation/aggregation.module'
import { TenantConfigModule } from './tenant-config.module'

const resolveModuleImports = (target: object) =>
  ((Reflect.getMetadata('imports', target) ?? []) as Array<any>).map((entry) =>
    typeof entry?.forwardRef === 'function' ? entry.forwardRef() : entry,
  )

describe('TenantConfigModule', () => {
  it('imports AggregationModule for recompute endpoint dependencies', () => {
    const imports = resolveModuleImports(TenantConfigModule)

    expect(imports).toContain(AggregationModule)
  })
})
