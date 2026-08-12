# identity

Owner đích: User, Role, Permission, authentication và access policy. T3.3 owns the safe
User/Role/Permission read API and current actor boundary.

Compatibility implementation: `src/auth`, `src/modules/users`, `src/modules/role`. User profile
address writes and shipper-specific operations remain legacy until Locations/Delivery command
contracts are available.
