# users

Owner đích: User, Role, Permission, authentication và access policy. T3.3 owns the safe
User/Role/Permission read API and current actor boundary.

Authentication is in `src/features/auth`; user/role services are in this feature. User profile
address writes and shipper-specific operations use the Locations/Delivery boundaries.
