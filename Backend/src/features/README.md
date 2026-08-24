# Feature boundary convention

Each migrated feature lives in `src/features/<feature-name>/`. Other features may import only its
`public-api.ts`; every controller, service, repository, entity and adapter implementation stays
internal.

```ts
import { MenuReader } from 'src/features/menu/public-api';
```

Cross-feature imports such as `src/features/menu/services/menu.service` are forbidden. A
feature must not import `src/infra/**` directly either; it defines or consumes a feature-owned port,
or uses an explicit public adapter contract under `src/infra/contracts/` when one exists.

`forwardRef()` is forbidden. Resolve module cycles with a public API, port, facade or event. A
provider may be declared once in a module; importing its owner module is the alternative to
re-providing it.

Legacy code in `src/modules`, `src/auth` and `src/payment` is migration debt. Do not copy its direct
service/repository imports into a new `src/features` slice.

A feature may temporarily import its own mapped legacy entity while persistence moves. It must not
import an entity owned by another feature; use that feature's `public-api.ts` contract instead.

Canonical folders are defined in `docs/architecture/foodee-ddd-clean-modular/00-feature-naming-convention.md`.
